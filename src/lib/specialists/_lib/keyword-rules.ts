export type KeywordRule = {
  keyword: string;
  match?: "exact" | "contains";
};

export type KeywordMappingRule = KeywordRule & { url: string };

export function assignKeywordUrl(
  keyword: string,
  candidates: string[],
  approved: KeywordMappingRule[] = [],
): string {
  const normalizedKeyword = keyword.toLowerCase().trim();
  const approvedMatch = approved.find((entry) => {
    const needle = entry.keyword.toLowerCase().trim();
    return entry.match === "contains"
      ? normalizedKeyword.includes(needle)
      : normalizedKeyword === needle;
  });
  if (approvedMatch) return approvedMatch.url;

  // An approved map is authoritative. Token-overlap may not override it;
  // unmatched broad terms belong to the homepage pending an explicit rule.
  if (approved.length > 0) return "/";

  const words = normalizedKeyword.split(/\s+/).filter((word) => word.length > 2);
  let best = "/";
  let bestScore = 0;
  for (const candidate of candidates) {
    const slug = candidate.toLowerCase().replace(/[^a-z0-9]+/g, " ");
    const score = words.filter((word) => slug.includes(word)).length;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

export function isExcludedKeyword(keyword: string, exclusions: KeywordRule[]): boolean {
  const normalized = keyword.toLowerCase().trim();
  return exclusions.some((entry) => {
    const needle = entry.keyword.toLowerCase().trim();
    return entry.match === "contains" ? normalized.includes(needle) : normalized === needle;
  });
}
