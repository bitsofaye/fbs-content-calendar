import { useEffect } from 'react';

// The FBS brand colour. Its own calendar keeps the exact hand-picked FBS palette from index.css.
export const FBS_COLOR = '#921259';

const mix = (hex, other, pct) => `color-mix(in srgb, ${hex} ${pct}%, ${other})`;
export const isHex = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);

/** Relative luminance (0 = black, 1 = white) of a #rrggbb colour. */
export function luminance(hex) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Dark or white text, whichever reads better on the given background colour. */
export const textOn = (hex) => (isHex(hex) && luminance(hex) > 0.36 ? '#1a1016' : '#ffffff');

/**
 * A full set of day-mode theme shades worked out from a client's colours.
 * The main colour gives the tints, links and deep shades; the optional second colour gives the
 * accents (badges, focus rings, highlights). Very light colours are deepened so text stays readable.
 */
export function paletteFrom(hex, second) {
  const light = luminance(hex) > 0.4; // e.g. yellow: used as text it would vanish on white
  const main = light ? mix(hex, 'black', 62) : hex;
  const accent = isHex(second) ? second : null;
  return {
    '--color-brand-50': mix(hex, 'white', 7), // soft tint: hovers, unselected pills
    '--color-brand-100': mix(hex, 'white', 14), // tint: highlights
    '--color-brand-200': mix(hex, 'white', 28), // soft borders
    '--color-brand-500': accent || mix(hex, 'white', 82), // accent: focus rings, badges (2nd colour when set)
    '--color-brand-600': main, // the client colour itself: links, today, accents
    '--color-brand-700': mix(hex, 'black', light ? 45 : 70), // deep shade: headings, active menu item, selected tabs
    '--color-brand-800': mix(hex, 'black', light ? 35 : 55), // deeper: button gradient end
    '--color-brand-900': mix(hex, 'black', light ? 28 : 42), // darkest: thin line beside the active menu item
    '--color-accent': accent || mix(hex, 'white', 82),
    '--color-canvas': mix(hex, 'white', 3), // page background: a very light wash of the client colour
  };
}

const STYLE_ID = 'cc-client-brand';

/**
 * Colours the whole app in a client's brand colours while their login is used.
 * Day mode gets the shades above; night mode works its shades out from --brand-base and
 * --brand-accent (see index.css). FBS (and pages that belong to no client) use the FBS palette.
 */
export function useBrandTheme(color, secondColor) {
  const key = isHex(color) && color.toLowerCase() !== FBS_COLOR ? color.toLowerCase() : null;
  const second = key && isHex(secondColor) ? secondColor.toLowerCase() : null;
  useEffect(() => {
    document.getElementById(STYLE_ID)?.remove();
    if (!key) return undefined;
    const day = Object.entries(paletteFrom(key, second)).map(([k, v]) => `${k}: ${v};`).join(' ');
    // when the accent is light, white text on it (badges) switches to dark
    const accentText = second ? textOn(second) : '#ffffff';
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent =
      `:root { --brand-base: ${key}; --brand-accent: ${second || key}; } :root:not(.dark) { ${day} }` +
      (accentText !== '#ffffff' ? ` :root:not(.dark) .bg-brand-500.text-white { color: ${accentText}; }` : '');
    document.head.appendChild(el);
    return () => el.remove();
  }, [key, second]);
}
