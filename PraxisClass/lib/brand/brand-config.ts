/**
 * Brand configuration.
 *
 * The reference (live deployment) resolves the brand per vendor from the
 * desktop shell's User-Agent token. This workspace has no vendor shell: the
 * product ships with its own single brand, so the config is static and the
 * desktop flag is always off. The shape is kept so surfaces that read the
 * brand (home hero, workspace rail, site header) keep one source of truth.
 */

export interface BrandConfig {
  /** Full product name (page titles, logo alt text). */
  productName: string;
  /** Short name for space-constrained spots. */
  shortName: string;
  /** Logo asset under `public/`; pair with live text when it has no wordmark. */
  logoSrc: string;
  /** Whether `logoSrc` already carries the product wordmark. */
  logoHasWordmark: boolean;
  /** Square brand mark under `public/` (favicon, workspace header). */
  markSrc: string;
  /** Browser theme color (`<meta name="theme-color">` / PWA). */
  themeColor: string;
  /**
   * Brand tagline. The home hero renders the localized `home.slogan` key; this
   * is the brand-level default a vendor override would replace.
   */
  slogan: string;
  /**
   * Brand primary accent, mirroring `--primary` in `app/globals.css` (CSS
   * cannot import TS, so the two are kept in step by hand). Surfaces that set
   * the token in JS read it from here instead of repeating a literal.
   */
  primaryColor: {
    light: string;
    dark: string;
  };
}

/** The default brand: the product itself, with no vendor overrides. */
export const DEFAULT_BRAND: BrandConfig = {
  productName: '真需实创',
  shortName: '真需实创',
  logoSrc: '/zhenxu-mark-v2.png',
  logoHasWordmark: false,
  markSrc: '/zhenxu-mark-v2.png',
  themeColor: '#722ed1',
  slogan: '博学以启智，笃行以致用。',
  primaryColor: {
    light: '#722ed1',
    dark: '#8b47ea',
  },
};
