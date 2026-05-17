import { Platform, StyleSheet } from 'react-native';

// ── Editorial Gamer Design System ────────────────────────────────────────────
// Warm dark canvas · Copper accent · Strong typography

export const ED = {
  // Backgrounds
  bg: '#0E0C09',
  bgDeep: 'rgba(7,6,4,0.50)',
  surface1: '#16120D',
  surface2: '#1E1813',
  surface3: '#2A2218',

  // Lines / borders
  line: 'rgba(245,230,200,0.07)',
  lineStrong: 'rgba(245,230,200,0.14)',

  // Ink (text)
  ink: '#F5EFE3',
  ink2: '#C2B7A2',
  ink3: '#7A715F',
  ink4: '#463F33',

  // Copper accent
  copper: '#E9A26B',
  copperSoft: '#F0C094',
  copperDeep: '#C2632E',
  copperBg: 'rgba(233,162,107,0.10)',
  copperLine: 'rgba(233,162,107,0.30)',

  // Status colors
  moss: '#8FA56A',       // playing
  mossBg: 'rgba(143,165,106,0.12)',
  amber: '#D9A84B',      // paused
  amberBg: 'rgba(217,168,75,0.12)',
  rust: '#C16847',       // abandoned
  rustBg: 'rgba(193,104,71,0.12)',
  sky: '#7DA0C2',        // up next
  skyBg: 'rgba(125,160,194,0.12)',
  plum: '#B292C2',       // completed
  plumBg: 'rgba(178,146,194,0.12)',

  // Spacing
  gap: 16,
  gapSm: 10,
  gapLg: 24,
  radius: 14,
  radiusSm: 8,
  radiusLg: 20,
} as const;

export const MONO_FONT = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

// Status → color mapping
export const STATUS_COLORS: Record<string, { color: string; bg: string; label: string }> = {
  playing:     { color: ED.moss,  bg: ED.mossBg,  label: 'Playing' },
  up_next:     { color: ED.sky,   bg: ED.skyBg,   label: 'Up Next' },
  paused:      { color: ED.amber, bg: ED.amberBg, label: 'Paused' },
  completed:   { color: ED.plum,  bg: ED.plumBg,  label: 'Completed' },
  abandoned:   { color: ED.rust,  bg: ED.rustBg,  label: 'Abandoned' },
  not_started: { color: ED.ink3,  bg: ED.surface2, label: 'Not started' },
};

// Priority → glyph/color
export const PRIORITY_COLORS: Record<string, { color: string; glyph: string; label: string }> = {
  high:   { color: ED.rust,   glyph: '↑', label: 'High' },
  medium: { color: ED.amber,  glyph: '→', label: 'Med' },
  low:    { color: ED.ink3,   glyph: '↓', label: 'Low' },
};

// Cover art placeholder color pairs
const COVER_PALETTES = [
  { a: '#7a4a2a', b: '#2a1810' },
  { a: '#1f3a4d', b: '#0b1a26' },
  { a: '#5a2a3a', b: '#1f0e16' },
  { a: '#3a4a2a', b: '#161f0e' },
  { a: '#4a2a5a', b: '#1a0f24' },
  { a: '#5a4520', b: '#1c1408' },
  { a: '#2a3a4a', b: '#0e1620' },
  { a: '#4a3a2a', b: '#1a1208' },
  { a: '#2a2a3a', b: '#101018' },
  { a: '#5a3528', b: '#1f1108' },
];

export function coverPaletteFor(title: string, seed = 0) {
  const h = ((title.charCodeAt(0) || 0) + title.length + seed) % COVER_PALETTES.length;
  return COVER_PALETTES[h];
}

// Shared component styles
export const edStyles = StyleSheet.create({
  eyebrow: {
    fontFamily: MONO_FONT,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: ED.ink3,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  card: {
    backgroundColor: ED.surface1,
    borderWidth: 1,
    borderColor: ED.line,
    borderRadius: ED.radius,
  },
  displayTitle: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1.5,
    lineHeight: 38,
    color: ED.ink,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 24,
    color: ED.ink,
  },
  mono: {
    fontFamily: MONO_FONT,
  },
  progressBar: {
    height: 4,
    backgroundColor: ED.surface3,
    borderRadius: 100,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%' as any,
    backgroundColor: ED.copper,
    borderRadius: 100,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    backgroundColor: ED.surface2,
    borderWidth: 1,
    borderColor: ED.line,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '500',
    color: ED.ink2,
    letterSpacing: -0.1,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
    paddingHorizontal: 7,
    borderRadius: 4,
    backgroundColor: ED.surface2,
  },
  pillText: {
    fontFamily: MONO_FONT,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: ED.ink2,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ED.line,
    backgroundColor: ED.surface2,
  },
  btnText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
    color: ED.ink,
  },
  btnPrimary: {
    backgroundColor: ED.copper,
    borderColor: ED.copper,
  },
  btnPrimaryText: {
    color: '#1A1108',
  },
  divider: {
    height: 1,
    backgroundColor: ED.line,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: ED.line,
  },
  specKey: {
    fontFamily: MONO_FONT,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: ED.ink3,
  },
  specVal: {
    fontSize: 14,
    fontWeight: '600',
    color: ED.ink,
  },
});
