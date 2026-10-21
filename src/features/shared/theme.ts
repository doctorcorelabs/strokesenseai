/**
 * Local design tokens for the shared feature UI kit.
 *
 * These mirror the global design system in src/styles.css (PLANNING.md
 * section 5: greens #126454 and #153e34, Manrope display, DM Sans body)
 * so kit components can use inline styles without touching the global
 * stylesheet. If the global tokens ever change, update this file to match.
 */
export const TOKENS = {
  green: '#126454',
  deep: '#153e34',
  ink: '#243b36',
  muted: '#4e5b56',
  line: '#e2e8e2',
  mint: '#eaf3ed',
  mintStrong: '#d7e9dc',
  card: '#ffffff',
  amber: '#814c1c',
  amberSoft: '#faf0e2',
  red: '#983a27',
  redSoft: '#fbeae6',
  radius: 16,
  radiusSm: 10,
  shadow: '0 10px 30px rgba(21, 62, 52, 0.08)',
  displayFont: '"Manrope Variable", "DM Sans Variable", system-ui, sans-serif',
  bodyFont: '"DM Sans Variable", system-ui, -apple-system, "Segoe UI", sans-serif',
} as const;

/** Soft panel surface used by kit widgets that live inside a page panel. */
export const softPanelStyle = {
  background: TOKENS.mint,
  border: `1px solid ${TOKENS.line}`,
  borderRadius: TOKENS.radiusSm,
  padding: '1rem',
} as const;

/** Big readout number style shared by measure displays. */
export const readoutValueStyle = {
  fontFamily: TOKENS.displayFont,
  fontWeight: 800,
  fontSize: '1.9rem',
  lineHeight: 1.1,
  color: TOKENS.deep,
} as const;
