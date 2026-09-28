// A lightweight display-name filter — port of src/lib/profanity.js.
// Normalizes the input (lowercase, strip non-letters) before checking.

const BLOCKED_WORDS = [
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'dick', 'piss',
  'nigger', 'nigga', 'chink', 'spic', 'kike', 'faggot', 'fag', 'retard',
  'whore', 'slut', 'rape',
  'admin', 'administrator', 'moderator', 'support', 'medconnect', 'official',
];

export function containsBlockedWord(text?: string | null): boolean {
  if (!text) return false;
  const normalized = text.toLowerCase().replace(/[^a-z0-9]/g, '');
  return BLOCKED_WORDS.some((word) => normalized.includes(word));
}
