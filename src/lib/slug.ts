/**
 * Slug generation. Spot slugs are stable once created (editing a spot does not change
 * its slug), generated from the name and made unique with a numeric suffix.
 */

const LATVIAN: Record<string, string> = {
  ā: "a",
  č: "c",
  ē: "e",
  ģ: "g",
  ī: "i",
  ķ: "k",
  ļ: "l",
  ņ: "n",
  š: "s",
  ū: "u",
  ž: "z",
};

export function slugify(input: string): string {
  const transliterated = Array.from(input)
    .map((ch) => LATVIAN[ch.toLowerCase()] ?? ch)
    .join("")
    // Decompose accents (e.g. é → e + combining mark) and drop the combining marks.
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return transliterated
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}
