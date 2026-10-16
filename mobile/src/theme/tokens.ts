export type ThemeMode = 'light' | 'dark';

// ============================================================================
// MedPeers redesign - "warm paper · ink · bold type · colour panels · stickers"
// Full spec lives in MEGA-PROMPT.md §2. Every colour on screen must resolve to
// a token here; screens should never hard-code hex.
// ============================================================================

export interface ThemeColors {
  // --- core surfaces -------------------------------------------------------
  /** Headlines, primary CTA fill, active tab fill */
  ink: string;
  /** Secondary headline, list item titles */
  inkSoft: string;
  /** Screen background (warm cream) */
  paper: string;
  /** Sunken strips, section frames, skeleton fills */
  paper2: string;
  /** Card / sticker / input surface */
  card: string;
  /** 1.5px hairline borders, dividers */
  line: string;

  // --- colour panels -------------------------------------------------------
  /** Deep green panels: onboarding 1, Home hero, OSCE hero, drawer header */
  forest: string;
  /** Pressed state of forest surfaces */
  forest2: string;
  /** Accent ON forest (progress arcs, streak, live dot) */
  mint: string;
  /** Onboarding 2 panel */
  sky: string;
  /** Ring strokes / accents on sky */
  skyDeep: string;
  /** Partners-online card, blue bento card */
  blue: string;
  /** Navy "ESSENTIALS" bento card */
  navy: string;
  /** Gold-tint tile / bento card */
  cream: string;

  // --- accents -------------------------------------------------------------
  /** Primary accent CTA - Resume, Start a room, Add, live dot */
  orange: string;
  /** Sticker fill, "OSCE TODAY" bento card */
  orangeHot: string;
  /** Pro tier, gold accents, links on cream */
  gold: string;
  /** Success, progress bar fills */
  green: string;
  /** "Total" stat tile */
  greenDeep: string;

  // --- tints (pill / tile backgrounds) -------------------------------------
  tintRust: string;
  tintGreen: string;
  tintBlue: string;
  tintGold: string;

  // --- text ----------------------------------------------------------------
  /** Body, subtitles, secondary labels */
  muted: string;
  /** Placeholder, disabled, empty-state */
  subtle: string;
  /** Text/icons on forest, ink and orange surfaces */
  onForest: string;

  // --- legacy aliases kept so existing call sites keep working -------------
  /** @deprecated use `orange` (this is the CTA accent, not a red) */
  rust: string;
  topbarBg: string;
  sectionHero: string;

  // --- per-module hero bands (all stay dark in both themes; cream + gold
  // type sits on them). Pro + Clinical Insights keep `sectionHero` green.
  /** Study Planner - midnight navy, planning under a calm night sky */
  heroPlanner: string;
  /** Lab Values - oxblood, blood and clinical precision */
  heroLabs: string;
  /** Notes Vault - vault ink, dark and private */
  heroNotes: string;
  /** Resources - scrubs teal, instruments and trusted tools */
  heroTools: string;
  /** Formulas - blueprint indigo, technical drawings and logic */
  heroFormulas: string;
  /** Qbank + practice - medal bronze, progress you earn */
  heroQbank: string;
  /** Focus - ember, guard your time like fire */
  heroFocus: string;
  /** Messages - terracotta, peer warmth */
  heroChat: string;
  /** Motivation - sunrise amber, dawn and inspiration */
  heroMotivation: string;
  /** About, Legal, AboutDev - corporate slate, the quiet trio */
  heroSlate: string;
  // --- home toolkit tiles (board pastels - vivid enough to pop off paper) --
  /** Qbank tile - sage */
  tileQbank: string;
  /** Tracker tile - peach */
  tileTracker: string;
  /** Essentials tile - sky */
  tileEssentials: string;
  /** LogBook tile - sand */
  tileLogbook: string;
  /** OSCE feed tile - flat vivid orange, same fill in light and dark so it
      always matches the Practise AccentButton (which is also flat) */
  tileOsce: string;
}

export const lightColors: ThemeColors = {
  ink: '#171310',
  inkSoft: '#3B342B',
  paper: '#F6F2E9',
  paper2: '#EDE7DA',
  card: '#FFFDF8',
  line: '#E4DDCC',

  forest: '#14402F',
  forest2: '#1E5A44',
  mint: '#7FD1B0',
  sky: '#C2E4F5',
  skyDeep: '#8FCDEF',
  blue: '#D8EBFA',
  navy: '#1B2A45',
  cream: '#F7EDD6',

  orange: '#E85C2A',
  orangeHot: '#F26430',
  gold: '#B9863A',
  green: '#1F8A5F',
  greenDeep: '#1E5C43',

  tintRust: '#FBE3D6',
  tintGreen: '#DDEFE4',
  tintBlue: '#E3F1FB',
  tintGold: '#F6E9C8',

  muted: '#7C7669',
  subtle: '#A79F90',
  onForest: '#F6F2E9',

  rust: '#E85C2A',
  topbarBg: '#FFFDF8',
  sectionHero: '#14402F',

  heroPlanner: '#1B2A45',
  heroLabs: '#5E1F14',
  heroNotes: '#171310',
  heroTools: '#174E50',
  heroFormulas: '#2B3055',
  heroQbank: '#6B4A12',
  heroFocus: '#A63A1A',
  heroChat: '#9A4A2E',
  heroMotivation: '#8A5A1A',
  heroSlate: '#2F353B',

  tileQbank: '#CFE3D3',
  tileTracker: '#F6D8C3',
  tileEssentials: '#A4E1F4',
  tileLogbook: '#fcd258',
  tileOsce: '#F0653A',
};

export const darkColors: ThemeColors = {
  ink: '#F2ECDC',
  inkSoft: '#CFC7B4',
  paper: '#161310',
  paper2: '#1E1A15',
  card: '#2C261D',
  line: '#3A3327',

  // forest panels do NOT invert - they are the one surface that stays dark
  forest: '#1B4E3B',
  forest2: '#256549',
  mint: '#7FD1B0',
  sky: '#24404E',
  skyDeep: '#3E6B80',
  blue: '#1F3448',
  navy: '#1A2438',
  cream: '#332B1C',

  orange: '#F0825A',
  orangeHot: '#F58A5E',
  gold: '#D8A84A',
  green: '#3CAD82',
  greenDeep: '#1E5C43',

  tintRust: '#3A241A',
  tintGreen: '#1B2E24',
  tintBlue: '#182A38',
  tintGold: '#332B1C',

  muted: '#A39B8B',
  subtle: '#857C6D',
  onForest: '#F2ECDC',

  rust: '#F0825A',
  topbarBg: '#231E17',
  sectionHero: '#1B4E3B',

  heroPlanner: '#1A2438',
  heroLabs: '#7E2F20',
  heroNotes: '#241D16',
  heroTools: '#205F61',
  heroFormulas: '#3A4170',
  heroQbank: '#8A6420',
  heroFocus: '#C05A30',
  heroChat: '#B2603F',
  heroMotivation: '#A5752B',
  heroSlate: '#3A4046',

  tileQbank: '#234034',
  tileTracker: '#572B1B',
  tileEssentials: '#16394E',
  tileLogbook: '#8A6D1B',
  tileOsce: '#F0653A',
};

// ============================================================================
// Shape / space / type scales - MEGA-PROMPT.md §4 and §3.
// Import these rather than re-literal-ing the numbers in StyleSheet blocks.
// ============================================================================

export const radius = {
  card: 18,
  panel: 26,
  tile: 16,
  input: 14,
  pill: 999,
} as const;

export const space = {
  screenX: 18,
  screenTop: 14,
  sectionGap: 22,
  cardPad: 16,
  gutter: 10,
  tabClear: 96,
} as const;

export const border = {
  /** hairline used on every card, input, sticker and tile */
  hair: 1.5,
} as const;

export const type = {
  /** Display H1 - Fraunces 700 */
  display: { fontSize: 30, lineHeight: 34, letterSpacing: -0.6 },
  /** Screen title - Fraunces 700 */
  title: { fontSize: 26, lineHeight: 30, letterSpacing: -0.4 },
  /** Hero numeral - Fraunces 700 */
  numeral: { fontSize: 40, lineHeight: 42, letterSpacing: -1.0 },
  /** Section header - system sans 700 */
  section: { fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  /** Eyebrow / micro-label - Montserrat Bold, UPPERCASE */
  eyebrow: { fontSize: 11, letterSpacing: 0.8 },
  /** Body - system sans 400 */
  body: { fontSize: 15, lineHeight: 21 },
  /** Secondary */
  small: { fontSize: 13.5, lineHeight: 18 },
  /** Chip / pill */
  chip: { fontSize: 13, lineHeight: 16 },
  /** Tab label */
  tab: { fontSize: 10.5, lineHeight: 12 },
} as const;

/** The only two shadows in the design - floating stickers and the tab capsule. */
export const shadow = {
  float: {
    shadowColor: '#171310',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
} as const;
