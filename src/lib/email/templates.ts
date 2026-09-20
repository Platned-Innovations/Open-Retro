const BRAND = "#4f46e5";
const TEXT = "#111827";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";
const CARD_BG = "#f9fafb";
const PAGE_BG = "#f4f4f7";
const FONT = "Arial, Helvetica, sans-serif";

/** User-supplied content (names, comments, descriptions) goes through here before it's interpolated into HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Table-based layout throughout — Outlook's desktop rendering engine (Word)
 * ignores most modern CSS (flexbox, div max-width, background on <a>, etc.),
 * so anything meant to look consistent across clients has to be built the
 * old-fashioned way: nested tables, inline styles, and HTML attributes as a
 * fallback for the styles Outlook drops.
 */
function layout(params: { eyebrow: string; bodyHtml: string; footerHtml?: string }): string {
  const { eyebrow, bodyHtml, footerHtml } = params;
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:${PAGE_BG};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAGE_BG};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;background-color:#ffffff;border:1px solid ${BORDER};border-radius:12px;">
            <tr>
              <td style="padding:32px 40px 8px 40px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background-color:${BRAND};width:28px;height:28px;border-radius:7px;text-align:center;vertical-align:middle;">
                      <span style="font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;line-height:28px;">R</span>
                    </td>
                    <td style="padding-left:10px;font-family:${FONT};font-size:16px;font-weight:700;color:${TEXT};">
                      Agile Retro
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 40px 0 40px;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:0.06em;color:${BRAND};text-transform:uppercase;">
                ${eyebrow}
              </td>
            </tr>
            <tr>
              <td style="padding:12px 40px 36px 40px;font-family:${FONT};font-size:15px;line-height:1.6;color:${TEXT};">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 40px;background-color:${CARD_BG};border-top:1px solid ${BORDER};border-radius:0 0 12px 12px;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};">
                ${footerHtml ?? "You're receiving this because of activity on a retrospective you're part of."}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Bulletproof CTA button: styled via CSS for modern clients, with HTML attributes Outlook honors as a fallback. */
function button(url: string, label: string): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
    <tr>
      <td align="center" bgcolor="${BRAND}" style="border-radius:8px;background-color:${BRAND};">
        <a href="${url}" target="_blank" style="display:inline-block;padding:12px 28px;font-family:${FONT};font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;
}

function fallbackLink(url: string): string {
  return `<p style="margin:16px 0 0 0;font-size:13px;color:${MUTED};">If the button doesn't work, paste this into your browser:<br/><a href="${url}" style="color:${BRAND};word-break:break-all;">${url}</a></p>`;
}

function quote(content: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;width:100%;">
    <tr>
      <td style="border-left:3px solid ${BRAND};padding:2px 0 2px 14px;font-family:${FONT};font-size:14px;color:#374151;">
        ${escapeHtml(content)}
      </td>
    </tr>
  </table>`;
}

export function loginLinkEmail(url: string): { subject: string; html: string } {
  return {
    subject: "Your Agile Retro sign-in link",
    html: layout({
      eyebrow: "Sign in",
      bodyHtml: `
        <p style="margin:0 0 4px 0;">Click below to sign in to Agile Retro.</p>
        ${button(url, "Sign in →")}
        ${fallbackLink(url)}
      `,
      footerHtml: "This link expires in 12 hours and can only be used once.",
    }),
  };
}

export function invitationEmail(params: {
  url: string;
  inviterName: string;
  projectName?: string;
  companyName?: string;
}): { subject: string; html: string } {
  const inviterName = escapeHtml(params.inviterName);
  const projectName = params.projectName ? escapeHtml(params.projectName) : undefined;
  const companyName = params.companyName ? escapeHtml(params.companyName) : undefined;
  const target = projectName
    ? `the <strong>${projectName}</strong> project`
    : companyName
      ? `<strong>${companyName}</strong>`
      : "Agile Retro";
  return {
    subject: `${params.inviterName} invited you to ${params.projectName ?? params.companyName ?? "Agile Retro"}`,
    html: layout({
      eyebrow: "You're invited",
      bodyHtml: `
        <p style="margin:0 0 4px 0;"><strong>${inviterName}</strong> invited you to join ${target} on Agile Retro.</p>
        ${button(params.url, "Accept invitation →")}
        ${fallbackLink(params.url)}
      `,
      footerHtml: "This link expires in 12 hours and can only be used once.",
    }),
  };
}

/**
 * For adding an *existing* company member straight to a project — they can
 * already sign in, so this is a notification, not a login link (no token,
 * no 12h expiry).
 */
export function addedToProjectEmail(params: {
  url: string;
  actorName: string;
  projectName: string;
}): { subject: string; html: string } {
  const actorName = escapeHtml(params.actorName);
  const projectName = escapeHtml(params.projectName);
  return {
    subject: `You've been added to ${params.projectName}`,
    html: layout({
      eyebrow: "New project access",
      bodyHtml: `
        <p style="margin:0 0 4px 0;"><strong>${actorName}</strong> added you to the <strong>${projectName}</strong> project on Agile Retro.</p>
        ${button(params.url, "View project →")}
        <p style="margin:16px 0 0 0;font-size:13px;color:${MUTED};">Sign in with your usual email if you're not already.</p>
      `,
    }),
  };
}

export function mentionEmail(params: {
  url: string;
  authorName: string;
  retroTitle: string;
  content: string;
}): { subject: string; html: string } {
  const authorName = escapeHtml(params.authorName);
  const retroTitle = escapeHtml(params.retroTitle);
  return {
    subject: `${params.authorName} mentioned you in "${params.retroTitle}"`,
    html: layout({
      eyebrow: "You were mentioned",
      bodyHtml: `
        <p style="margin:0 0 4px 0;"><strong>${authorName}</strong> mentioned you in a comment on <strong>${retroTitle}</strong>:</p>
        ${quote(params.content)}
        ${button(params.url, "View retrospective →")}
      `,
    }),
  };
}

export function actionItemAssignedEmail(params: {
  url: string;
  assignerName: string;
  retroTitle: string;
  description: string;
}): { subject: string; html: string } {
  const assignerName = escapeHtml(params.assignerName);
  const retroTitle = escapeHtml(params.retroTitle);
  return {
    subject: `New action item from "${params.retroTitle}"`,
    html: layout({
      eyebrow: "New action item",
      bodyHtml: `
        <p style="margin:0 0 4px 0;"><strong>${assignerName}</strong> assigned you an action item in <strong>${retroTitle}</strong>:</p>
        ${quote(params.description)}
        ${button(params.url, "View retrospective →")}
      `,
    }),
  };
}

export function actionItemUnassignedEmail(params: {
  url: string;
  actorName: string;
  retroTitle: string;
  description: string;
}): { subject: string; html: string } {
  const actorName = escapeHtml(params.actorName);
  const retroTitle = escapeHtml(params.retroTitle);
  return {
    subject: `Removed from an action item in "${params.retroTitle}"`,
    html: layout({
      eyebrow: "Action item unassigned",
      bodyHtml: `
        <p style="margin:0 0 4px 0;"><strong>${actorName}</strong> removed you from an action item in <strong>${retroTitle}</strong>:</p>
        ${quote(params.description)}
        ${button(params.url, "View retrospective →")}
      `,
    }),
  };
}

export function actionItemCompletedEmail(params: {
  url: string;
  actorName: string;
  retroTitle: string;
  description: string;
}): { subject: string; html: string } {
  const actorName = escapeHtml(params.actorName);
  const retroTitle = escapeHtml(params.retroTitle);
  return {
    subject: `Action item completed in "${params.retroTitle}"`,
    html: layout({
      eyebrow: "Action item completed",
      bodyHtml: `
        <p style="margin:0 0 4px 0;"><strong>${actorName}</strong> marked an action item you're assigned to as done in <strong>${retroTitle}</strong>:</p>
        ${quote(params.description)}
        ${button(params.url, "View retrospective →")}
      `,
    }),
  };
}

export function actionItemDueEmail(params: {
  url: string;
  retroTitle: string;
  description: string;
  dueDate: Date;
  overdue: boolean;
}): { subject: string; html: string } {
  const retroTitle = escapeHtml(params.retroTitle);
  const due = params.dueDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return {
    subject: params.overdue
      ? `Overdue action item from "${params.retroTitle}"`
      : `Action item due soon from "${params.retroTitle}"`,
    html: layout({
      eyebrow: params.overdue ? "Overdue" : "Due soon",
      bodyHtml: `
        <p style="margin:0 0 4px 0;">An action item you're assigned to in <strong>${retroTitle}</strong> was due on <strong>${due}</strong>:</p>
        ${quote(params.description)}
        <p style="margin:0;">If it's done, mark it off. If it isn't going to happen, marking it dropped is a real answer too — it keeps the team's completion rate honest.</p>
        ${button(params.url, "Open my actions →")}
      `,
      // Said outright, because a reminder people cannot switch off is a
      // reminder they learn to filter.
      footerHtml:
        "You're receiving this once for this action item. We won't email you about it again.",
    }),
  };
}
