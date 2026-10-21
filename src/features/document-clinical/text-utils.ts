// Deterministic text helpers shared by the document labs.
// The core promise of this domain is verbatim grounding: an extracted fact
// or evidence quote is only trusted when it can be found, character for
// character (up to whitespace), inside the text the person provided.

import type { SourceLine, SourceSentence } from './types';

/** Split raw pasted text into numbered, non-empty source lines. */
export function splitIntoLines(text: string): SourceLine[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, index) => ({ id: index + 1, text: line }));
}

/**
 * Split text into sentences, keeping the exact character span of each one
 * in the original text so an evidence quote is a true substring by
 * construction. Splitting is deliberately simple (terminal punctuation or
 * line breaks); it never rewrites the text.
 */
export function splitIntoSentences(text: string): SourceSentence[] {
  const sentences: SourceSentence[] = [];
  const pattern = /[^.!?\n]+(?:[.!?]+|\n+|$)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const raw = match[0];
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const leading = raw.length - raw.trimStart().length;
    const start = match.index + leading;
    sentences.push({
      index: sentences.length,
      text: trimmed,
      start,
      end: start + trimmed.length,
    });
  }
  return sentences;
}

/** Collapse every run of whitespace to a single space. */
export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ');
}

/**
 * Find `needle` inside `haystack` allowing only whitespace differences.
 * Returns the exact slice of the haystack that matched, or null. This is
 * the deterministic verbatim check both labs run before calling anything
 * verified: dates, doses, and quotes are never trusted on the model's or
 * the parser's word alone.
 */
export function findVerbatimSpan(haystack: string, needle: string): string | null {
  const wanted = collapseWhitespace(needle.trim());
  if (!wanted) return null;
  const source = collapseWhitespace(haystack);
  const at = source.indexOf(wanted);
  if (at === -1) return null;
  return source.slice(at, at + wanted.length);
}

/** True when `needle` appears in `haystack` word-for-word (whitespace aside). */
export function isVerbatimSubstring(haystack: string, needle: string): boolean {
  return findVerbatimSpan(haystack, needle) !== null;
}

/** Remove a leading list marker ("-", "*", a bullet, or "1.") from a line. */
export function stripBullet(line: string): string {
  return line.replace(/^\s*(?:[-*•·]|\d{1,2}[.)])\s+/, '').trim();
}
