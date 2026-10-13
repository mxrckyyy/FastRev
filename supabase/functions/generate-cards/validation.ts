// Pure input validation for the generate-cards Edge Function.
//
// No remote imports — runs under Deno AND under Node >= 22 type-stripping,
// so the contract below is unit-testable without the Supabase CLI.

/** Hard ceiling mirroring the frontend textarea cap (Upload.jsx). */
export const MAX_CHARS = 60000;

/** Intended per-request limit for generation (words, Unicode-aware). */
export const MAX_WORDS = 5000;

export type NotesValidation =
  | { ok: true; notes: string }
  | { ok: false; code: "missing_notes" | "notes_too_long"; message: string };

/** Count whitespace-separated words. Empty / whitespace-only → 0. */
export function countWords(text: string): number {
  const matches = text.match(/\S+/g);
  return matches ? matches.length : 0;
}

/**
 * Validate the caller-supplied `notes` field.
 * Returns the trimmed notes on success — callers must use the returned
 * value, never the raw input (trailing whitespace inflates billing).
 */
export function validateNotes(value: unknown): NotesValidation {
  if (typeof value !== "string" || value.trim().length === 0) {
    return {
      ok: false,
      code: "missing_notes",
      message: "Request body must include a non-empty 'notes' string.",
    };
  }
  const notes = value.trim();
  if (notes.length > MAX_CHARS) {
    return {
      ok: false,
      code: "notes_too_long",
      message: `Notes exceed the ${MAX_CHARS.toLocaleString()}-character limit. Trim them and try again.`,
    };
  }
  const words = countWords(notes);
  if (words > MAX_WORDS) {
    return {
      ok: false,
      code: "notes_too_long",
      message: `Notes exceed the ${MAX_WORDS.toLocaleString()}-word limit (got ${words.toLocaleString()} words). Trim them and try again.`,
    };
  }
  return { ok: true, notes };
}
