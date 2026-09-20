import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/tokens";
import { rateLimit } from "@/lib/rateLimit";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // 7 days rather than Auth.js's 30-day default. Defence in depth only: role
  // and name are re-read from the database on every request (see requireUser in
  // authz.ts), so a stale token no longer carries stale privileges.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [
    // Super Admins only: email + password.
    Credentials({
      id: "password",
      name: "Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const email = String(raw?.email ?? "").trim().toLowerCase();
        const password = String(raw?.password ?? "");
        if (!email || !password) return null;

        // Keyed on the email rather than the IP: headers() isn't reliably
        // available inside this callback. The global counter is what stops an
        // attacker simply rotating addresses. A refusal returns null, which is
        // indistinguishable from a wrong password.
        const perEmail = rateLimit(`password:${email}`, { limit: 5, windowMs: 15 * 60_000 });
        const global = rateLimit("password:*", { limit: 100, windowMs: 15 * 60_000 });
        if (!perEmail.ok || !global.ok) {
          console.warn(`Rate-limited password sign-in attempt for ${email}`);
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || user.role !== "SUPER_ADMIN" || !user.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
    // Everyone else: one-time, 12h magic-link token minted by /login/request-link
    // or an invitation email, redeemed at /auth/verify.
    Credentials({
      id: "login-token",
      name: "Login link",
      credentials: { token: { label: "Token", type: "text" } },
      async authorize(raw) {
        const rawToken = String(raw?.token ?? "");
        if (!rawToken) return null;

        const tokenHash = hashToken(rawToken);
        const record = await prisma.loginToken.findUnique({
          where: { tokenHash },
          include: { user: true },
        });
        if (!record || record.usedAt || record.expiresAt < new Date()) return null;

        await prisma.loginToken.update({
          where: { id: record.id },
          data: { usedAt: new Date() },
        });

        const { user } = record;
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: "SUPER_ADMIN" | "USER" }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "SUPER_ADMIN" | "USER";
      }
      return session;
    },
  },
});
