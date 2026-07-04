const COMPLETION_FUZZY_MIN_QUERY_LENGTH = 2;
const COMPLETION_NEXT_CHARACTER_STEP = 1;

export function workspaceCompletionMatches(label: string, query: string): boolean {
  const normalizedQuery = query.toLowerCase();
  return (
    normalizedQuery.length === 0 ||
    fuzzyCompletionMatch(label.toLowerCase(), normalizedQuery)
  );
}

function fuzzyCompletionMatch(label: string, query: string): boolean {
  if (query.length < COMPLETION_FUZZY_MIN_QUERY_LENGTH) {
    return label.startsWith(query);
  }

  let labelIndex = 0;
  for (const character of query) {
    const nextIndex = label.indexOf(character, labelIndex);
    if (nextIndex < 0) {
      return false;
    }
    labelIndex = nextIndex + COMPLETION_NEXT_CHARACTER_STEP;
  }
  return true;
}
