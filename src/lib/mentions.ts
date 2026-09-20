type Member = { id: string; name: string };

/** Characters that may legitimately follow a name and still end the mention. */
const WORD_CHARACTER = /[\p{L}\p{N}_]/u;

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Very small @mention parser: looks for "@Full Name" (case-insensitive,
 * longest match wins so "@Jane Doe" doesn't only match "@Jane") against a
 * known list of project members and returns the matched user ids.
 *
 * The match must end at a word boundary. A plain substring test also fired on
 * "@Sam" inside "@Samantha", which quietly emailed the wrong person — and,
 * because the longest name wins only when it is itself present, could email
 * someone who was never mentioned at all.
 */
export function extractMentionedUserIds(content: string, members: Member[]): string[] {
  const sorted = [...members].sort((a, b) => b.name.length - a.name.length);
  const matched = new Set<string>();

  for (const member of sorted) {
    const needle = `@${member.name}`;
    const pattern = new RegExp(escapeForRegex(needle), "giu");

    for (const match of content.matchAll(pattern)) {
      const next = content[match.index + needle.length];
      if (next === undefined || !WORD_CHARACTER.test(next)) {
        matched.add(member.id);
        break;
      }
    }
  }

  return [...matched];
}
