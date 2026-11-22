/** Up to two initials of a store name, for the monogram shown when the store has no logo. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words.slice(0, 2).map((w) => [...w][0]) : [...(words[0] ?? "")].slice(0, 2);
  return letters.join("").toUpperCase();
}
