// A lightweight display-name filter. Not meant to be unbeatable — just a first
// line of defense against obviously inappropriate or impersonation-style names.
// Normalizes the input (lowercase, strip non-letters) before checking, so simple
// tricks like "F.U.C.K" or "fuck123" still get caught.

const BLOCKED_WORDS = [
  // profanity / slurs (kept to clearly offensive terms, not borderline slang)
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'dick', 'piss',
  'nigger', 'nigga', 'chink', 'spic', 'kike', 'faggot', 'fag', 'retard',
  'whore', 'slut', 'rape',
  // impersonation risk — names that could look like an official account
  'admin', 'administrator', 'moderator', 'support', 'medconnect', 'official',
];

export function containsBlockedWord(text) {
  if (!text) return false;
  const normalized = text.toLowerCase().replace(/[^a-z0-9]/g, '');
  return BLOCKED_WORDS.some((word) => normalized.includes(word));
}

