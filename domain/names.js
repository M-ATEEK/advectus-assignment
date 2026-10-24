/** "Wärtsilä Finland Oy " → "wartsila finland oy": lowercase, no diacritics, single spaces, letters and digits only. */
export const normalizeName = (name) =>
  String(name ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
