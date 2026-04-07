// Converts a name + id into a URL-friendly slug
// e.g. "JC Personal", 1 → "jc-personal-1"
export function toSpendingSlug(name: string, id: number): string {
  const nameSlug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
  return `${nameSlug}-${id}`;
}

// Extracts the id from the end of a name+id slug
// e.g. "jc-personal-1" → 1
export function extractIdFromSlug(slug: string): number {
  const parts = slug.split("-");
  return Number(parts[parts.length - 1]);
}
