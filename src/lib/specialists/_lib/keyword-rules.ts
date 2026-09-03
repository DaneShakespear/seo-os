export type KeywordRule = {
  keyword: string;
  match?: "exact" | "contains";
};

export function isExcludedKeyword(keyword: string, exclusions: KeywordRule[]): boolean {
  const normalized = keyword.toLowerCase().trim();
  return exclusions.some((entry) => {
    const needle = entry.keyword.toLowerCase().trim();
    return entry.match === "contains" ? normalized.includes(needle) : normalized === needle;
  });
}
