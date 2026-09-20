"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { generateRawToken, hashToken, LOGIN_TOKEN_TTL_MS } from "@/lib/tokens";
import { sendMail } from "@/lib/email/graphMailer";
import { loginLinkEmail } from "@/lib/email/templates";
import { rateLimit } from "@/lib/rateLimit";

/** Azure App Service sets x-forwarded-for; the client is the first entry. */
async function callerIp(): Promise<string> {
  const forwarded = (await headers()).get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

/**
 * Only a same-origin, single-leading-slash path is allowed through as a
 * post-login destination — anything else (a full URL, a protocol-relative
 * "//evil.com", a bare "evil.com") could turn the emailed link into an open
 * redirect, so it's dropped in favor of the default.
 */
function sanitizeCallbackPath(path: string | undefined | null): string | null {
  if (!path) return null;
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}

/**
 * Request a 12h magic-link login email. Always resolves the same way whether
 * or not the address is registered, so this can't be used to enumerate users.
 *
 * `callbackUrl` is where the link drops the user after they verify — e.g. the
 * retro they followed a shared link to — instead of always landing on "/".
 */
export async function requestLoginLink(
  emailRaw: string,
  callbackUrl?: string,
): Promise<{ ok: true }> {
  const email = emailRaw.trim().toLowerCase();

  // This is the only action reachable without signing in, and each call sends
  // mail through the company's Graph sender. Uncapped it is a way to mailbomb a
  // known address, burn the tenant's send quota, and get the sender's
  // reputation flagged.
  //
  // A refusal returns the same { ok: true } as everything else: the comment
  // below is explicit that the response must not vary by whether the address is
  // registered, and telling a caller "you are being rate limited" would leak
  // exactly that signal back. Ops can see it in the log.
  const perEmail = rateLimit(`login-link:email:${email}`, { limit: 3, windowMs: 15 * 60_000 });
  const perIp = rateLimit(`login-link:ip:${await callerIp()}`, { limit: 20, windowMs: 15 * 60_000 });
  if (!perEmail.ok || !perIp.ok) {
    console.warn(`Rate-limited login link request for ${email}`);
    return { ok: true };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const rawToken = generateRawToken();
    await prisma.loginToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + LOGIN_TOKEN_TTL_MS),
      },
    });

    const safeCallback = sanitizeCallbackPath(callbackUrl);
    const url = new URL("/auth/verify", process.env.APP_URL);
    url.searchParams.set("token", rawToken);
    if (safeCallback) url.searchParams.set("callbackUrl", safeCallback);

    const { subject, html } = loginLinkEmail(url.toString());
    await sendMail({ to: user.email, subject, html }).catch((err) => {
      // Don't leak delivery failures to the client; log for ops instead.
      console.error("Failed to send login link email:", err);
    });
  }

  return { ok: true };
}
