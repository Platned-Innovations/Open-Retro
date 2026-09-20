/**
 * Recurring themes across a project's retrospectives.
 *
 * Deliberately local: no model call, no new dependency, no retro content
 * leaving the infrastructure. The AI roadmap item is opt-in per company and off
 * by default, so the insights page has to be useful without it — and a team's
 * candid retro cards are the last thing that should quietly become someone
 * else's training data.
 *
 * Limitations, stated rather than hidden: no stemming, so "deploy" and
 * "deploys" are separate terms; English stopwords only; and it finds repeated
 * *wording*, not repeated meaning. It is a prompt for a human to look closer,
 * not an analysis.
 */

/** Common English words, plus the ones retro cards are simply made of. */
const STOPWORDS = new Set([
  "a", "about", "actually", "after", "again", "all", "also", "am", "an", "and", "another", "any",
  "are", "around", "as", "at", "back", "be", "because", "been", "before", "being", "better",
  "between", "both", "but", "by", "can", "cant", "could", "couldnt", "did", "didnt", "do", "does",
  "doesnt", "doing", "dont", "down", "during", "each", "even", "every", "few", "for", "from",
  "get", "getting", "go", "going", "good", "got", "had", "has", "have", "having", "he", "her",
  "here", "hers", "him", "his", "how", "i", "if", "im", "in", "into", "is", "isnt", "it", "its",
  "ive", "just", "keep", "know", "less", "like", "little", "lot", "made", "make", "making", "many",
  "maybe", "me", "might", "more", "most", "much", "must", "my", "need", "needs", "never", "new",
  "next", "no", "not", "now", "of", "off", "often", "on", "once", "one", "only", "or", "other",
  "our", "ours", "out", "over", "own", "people", "really", "right", "said", "same", "say", "see",
  "should", "since", "so", "some", "something", "still", "such", "sure", "take", "than", "that",
  "the", "their", "them", "then", "there", "these", "they", "thing", "things", "think", "this",
  "those", "through", "time", "times", "to", "too", "under", "until", "up", "us", "use", "used",
  "using", "very", "want", "was", "wasnt", "way", "we", "well", "went", "were", "what", "when",
  "where", "which", "while", "who", "why", "will", "with", "without", "wont", "work", "working",
  "would", "yet", "you", "your", "yours",
]);

const MIN_TERM_LENGTH = 3;

export type Theme = {
  term: string;
  /** How many distinct retros the term appeared in — the ranking signal. */
  retroCount: number;
  /** Total cards mentioning it, for context only. */
  cardCount: number;
  sampleCardIds: string[];
};

type ThemeCard = { id: string; retrospectiveId: string; content: string };

function tokenize(content: string): string[] {
  return content
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length >= MIN_TERM_LENGTH && !STOPWORDS.has(word));
}

/**
 * Unigrams and bigrams.
 *
 * Bigrams matter more than they look: "code review", "story points" and
 * "pull request" are themes, while each half on its own is noise.
 */
function termsIn(content: string): Set<string> {
  const words = tokenize(content);
  const terms = new Set<string>(words);
  for (let i = 0; i < words.length - 1; i += 1) {
    terms.add(`${words[i]} ${words[i + 1]}`);
  }
  return terms;
}

export function extractThemes(
  cards: ThemeCard[],
  options: { minRetros?: number; limit?: number } = {},
): Theme[] {
  const minRetros = options.minRetros ?? 2;
  const limit = options.limit ?? 12;

  const stats = new Map<string, { retros: Set<string>; cards: string[] }>();

  for (const card of cards) {
    // A Set per card, so saying the same word three times in one card counts
    // once — otherwise one person's rant outranks a genuine pattern.
    for (const term of termsIn(card.content)) {
      const entry = stats.get(term) ?? { retros: new Set<string>(), cards: [] };
      entry.retros.add(card.retrospectiveId);
      entry.cards.push(card.id);
      stats.set(term, entry);
    }
  }

  const themes: Theme[] = [];
  for (const [term, entry] of stats) {
    // Ranked by how many *retros* mention it, not how often it is said. One
    // person raising something three times in a single retro is not a
    // recurring theme; the same phrase in three retros is.
    if (entry.retros.size < minRetros) continue;
    themes.push({
      term,
      retroCount: entry.retros.size,
      cardCount: entry.cards.length,
      sampleCardIds: entry.cards.slice(0, 3),
    });
  }

  return themes
    .sort((a, b) => b.retroCount - a.retroCount || b.cardCount - a.cardCount || a.term.localeCompare(b.term))
    .filter((theme, _index, sorted) => !isSubsumed(theme, sorted))
    .slice(0, limit);
}

/**
 * Drops a single word when a phrase containing it scores just as well.
 *
 * Without this the list reads "code review", "code", "review" — three rows
 * saying one thing, crowding out the next real theme.
 */
function isSubsumed(theme: Theme, all: Theme[]): boolean {
  if (theme.term.includes(" ")) return false;
  return all.some(
    (other) =>
      other !== theme &&
      other.term.includes(" ") &&
      other.term.split(" ").includes(theme.term) &&
      other.retroCount >= theme.retroCount,
  );
}
