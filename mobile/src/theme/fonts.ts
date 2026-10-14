import { Platform } from 'react-native';

// Display face for the MedPeers redesign - "warm paper, ink and BOLD type".
// Fraunces TTFs are bundled as plain assets in
// android/app/src/main/assets/fonts/ (no npm package, per NO-EXPO.md).
//
// Android resolves fontFamily by exact FILENAME and then, if fontWeight is set
// to anything but the default, hunts for a matching `*_bold.ttf` variant that
// does not exist → silent fallback to the system sans. So FRAUNCES must be
// referenced with fontWeight left at default (the same trap already documented
// for Newsreader below). For a heavier cut, use FRAUNCES_BLACK instead of
// bumping the weight on FRAUNCES.
export const FRAUNCES = Platform.select({
  ios: 'Fraunces_700Bold',
  android: 'Fraunces_700Bold',
  default: 'Fraunces_700Bold',
});
export const FRAUNCES_BLACK = Platform.select({
  ios: 'Fraunces_900Black',
  android: 'Fraunces_900Black',
  default: 'Fraunces_900Black',
});

// App-wide display font: every `fontFamily: SERIF` call site (~60 of them -
// screen titles, big numerals, quote text) now renders Fraunces.
export const SERIF: string | undefined = FRAUNCES;

// Newsreader - the "peers" half of the MedPeers wordmark.
//
// The wordmark is UPRIGHT (non-italic) Newsreader Medium. Reference
// `NEWSREADER` for it, never `NEWSREADER_ITALIC`, and leave fontWeight at
// default - Android resolves by filename and would otherwise hunt for a
// `Newsreader_500Medium_bold.ttf` that does not exist.
//
// CAUTION: the older assets `Newsreader.ttf`, `Newsreader-Italic.ttf` and
// `Newsreader-MediumItalic.ttf` in assets/fonts are byte-identical copies of
// the *italic* variant. Do not reference 'Newsreader' as a family name - it
// would silently render italic. `Newsreader_500Medium.ttf` is the real upright
// cut and is what NEWSREADER points at.
export const NEWSREADER = Platform.select({
  ios: 'Newsreader_500Medium',
  android: 'Newsreader_500Medium',
  default: 'Newsreader_500Medium',
});

// Italic cut - reserved for editorial pull-quotes, NOT the app name.
export const NEWSREADER_ITALIC = Platform.select({
  ios: 'Newsreader_500Medium_Italic',
  android: 'Newsreader_500Medium_Italic',
  default: 'Newsreader_500Medium_Italic',
});

// Montserrat (TTFs bundled in android/app/src/main/assets/fonts).
// The italic is a separate asset, so it is referenced by its own family name
// and must NOT also set fontStyle: 'italic' (that would look for a missing
// variant). Bold is likewise a static asset referenced by name - keep its
// fontWeight at the default so Android does not hunt for a *_bold file.
export const MONTSERRAT = 'Montserrat-Regular';
export const MONTSERRAT_ITALIC = 'Montserrat-Italic';
export const MONTSERRAT_BOLD = 'Montserrat-Bold';

