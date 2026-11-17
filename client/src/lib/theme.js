import { useEffect } from 'react';

// Two colour themes:
//  - FBS: the FBS team always sees the hand-picked FBS burgundy palette from index.css, on every page and client.
//  - Client: a client login sees the whole app in its own company colour (set on Manage → Clients).
export const FBS_COLOR = '#921259';

// a shade of `hex` with a set lightness (0..1); chroma and hue come from the client colour
const shade = (hex, l, c = 'c') => `oklch(from ${hex} ${l} ${c} h)`;

/**
 * Day-mode shades worked out from one client colour. Light shades are fixed tints; the text shades are
 * capped in lightness, so even a very light client colour (yellow, pastel) still gives readable text on white.
 * Night mode works its own shades out from --brand-base (see index.css).
 */
export function paletteFrom(hex) {
  return {
    '--color-brand-50': shade(hex, 0.975, 'calc(c * 0.18)'), // soft tint: hovers, unselected pills
    '--color-brand-100': shade(hex, 0.945, 'calc(c * 0.3)'), // tint: highlights
    '--color-brand-200': shade(hex, 0.89, 'calc(c * 0.45)'), // soft borders
    '--color-brand-500': shade(hex, 'min(l, 0.62)'), // accent: focus rings, badges
    '--color-brand-600': shade(hex, 'min(l, 0.52)'), // the client colour (darkened only when too light to read): links, today
    '--color-brand-700': shade(hex, 'min(l * 0.75, 0.36)'), // deep shade: headings, active menu item, buttons
    '--color-brand-800': shade(hex, 'min(l * 0.65, 0.31)'), // deeper: button gradient end
    '--color-brand-900': shade(hex, 'min(l * 0.55, 0.26)'), // darkest: thin line beside the active menu item
    '--color-canvas': shade(hex, 0.985, 'calc(c * 0.08)'), // page background: a very light wash of the client colour
  };
}

const isHex = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
const STYLE_ID = 'cc-client-brand';
// index.html re-applies this saved style before the first paint, so a client's page never flashes burgundy
const STORE_KEY = 'cc_brand_css';

const store = (css) => {
  try {
    if (css) localStorage.setItem(STORE_KEY, css);
    else localStorage.removeItem(STORE_KEY);
  } catch {
    /* storage blocked: the colour still applies once the page has loaded */
  }
};

/**
 * Colours the whole app in a client's brand colour while a client is signed in.
 * Pass null for FBS accounts (and on sign-out) to keep the FBS palette.
 */
export function useBrandTheme(color) {
  const key = isHex(color) && color.toLowerCase() !== FBS_COLOR ? color.toLowerCase() : null;
  useEffect(() => {
    document.getElementById(STYLE_ID)?.remove();
    if (!key) {
      store(null);
      return undefined;
    }
    const day = Object.entries(paletteFrom(key)).map(([k, v]) => `${k}: ${v};`).join(' ');
    const css = `:root { --brand-base: ${key}; } :root:not(.dark) { ${day} }`;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = css;
    document.head.appendChild(el);
    store(css);
    return () => el.remove();
  }, [key]);
}
