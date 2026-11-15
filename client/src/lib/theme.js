import { useEffect } from 'react';

// The FBS brand colour. Its own calendar keeps the exact hand-picked FBS palette from index.css.
export const FBS_COLOR = '#921259';

const mix = (hex, other, pct) => `color-mix(in srgb, ${hex} ${pct}%, ${other})`;

/** A full set of day-mode theme shades worked out from one client colour. */
export function paletteFrom(hex) {
  return {
    '--color-brand-50': mix(hex, 'white', 7), // soft tint: hovers, unselected pills
    '--color-brand-100': mix(hex, 'white', 14), // tint: highlights
    '--color-brand-200': mix(hex, 'white', 28), // soft borders
    '--color-brand-500': mix(hex, 'white', 82), // lighter accent: focus rings, badges
    '--color-brand-600': hex, // the client colour itself: links, today, accents
    '--color-brand-700': mix(hex, 'black', 70), // deep shade: headings, active menu item, selected tabs
    '--color-brand-800': mix(hex, 'black', 55), // deeper: button gradient end
    '--color-brand-900': mix(hex, 'black', 42), // darkest: thin line beside the active menu item
    '--color-canvas': mix(hex, 'white', 3), // page background: a very light wash of the client colour
  };
}

const isHex = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
const STYLE_ID = 'cc-client-brand';

/**
 * Colours the whole app in a client's brand colour while their login is used.
 * Day mode gets the shades above; night mode works its shades out from --brand-base (see index.css).
 * FBS (and pages that belong to no client) use the default FBS burgundy palette.
 */
export function useBrandTheme(color) {
  const key = isHex(color) && color.toLowerCase() !== FBS_COLOR ? color.toLowerCase() : null;
  useEffect(() => {
    document.getElementById(STYLE_ID)?.remove();
    if (!key) return undefined;
    const day = Object.entries(paletteFrom(key)).map(([k, v]) => `${k}: ${v};`).join(' ');
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = `:root { --brand-base: ${key}; } :root:not(.dark) { ${day} }`;
    document.head.appendChild(el);
    return () => el.remove();
  }, [key]);
}
