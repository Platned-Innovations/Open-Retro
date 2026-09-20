import "server-only";
import { ConfidentialClientApplication } from "@azure/msal-node";

/**
 * Sends mail via Microsoft Graph, authenticating as the app registration
 * (client-credentials / app-only flow — no user sign-in involved). The app
 * registration needs the `Mail.Send` **application** permission with admin
 * consent granted, and GRAPH_SENDER_EMAIL must be a real mailbox that
 * registration is allowed to send as.
 */

let msalApp: ConfidentialClientApplication | null = null;

function getMsalApp(): ConfidentialClientApplication {
  if (msalApp) return msalApp;

  const tenantId = requireEnv("GRAPH_TENANT_ID");
  const clientId = requireEnv("GRAPH_CLIENT_ID");
  const clientSecret = requireEnv("GRAPH_CLIENT_SECRET");

  msalApp = new ConfidentialClientApplication({
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      clientSecret,
    },
  });
  return msalApp;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getGraphToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }
  const app = getMsalApp();
  const result = await app.acquireTokenByClientCredential({
    scopes: ["https://graph.microsoft.com/.default"],
  });
  if (!result?.accessToken) {
    throw new Error("Failed to acquire Microsoft Graph access token");
  }
  cachedToken = {
    value: result.accessToken,
    expiresAt: result.expiresOn ? result.expiresOn.getTime() : Date.now() + 55 * 60_000,
  };
  return cachedToken.value;
}

export type SendMailInput = {
  to: string | string[];
  subject: string;
  html: string;
};

export async function sendMail({ to, subject, html }: SendMailInput): Promise<void> {
  const sender = requireEnv("GRAPH_SENDER_EMAIL");
  const token = await getGraphToken();
  const recipients = (Array.isArray(to) ? to : [to]).map((address) => ({
    emailAddress: { address },
  }));

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: "HTML", content: html },
          toRecipients: recipients,
        },
        saveToSentItems: false,
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Graph sendMail failed (${res.status}): ${body}`);
  }
}
