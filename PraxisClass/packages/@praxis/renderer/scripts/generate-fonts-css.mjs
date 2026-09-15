/**
 * Generate fonts.css from fonts.config.mjs.
 *
 * Run via `pnpm run genfonts`. The package build runs this first so the CSS
 * always reflects the config. Do not edit fonts.css by hand.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { FONT_CDN_BASE_URL, FONT_DIR, FONT_FAMILIES, fontUrl } from '../fonts.config.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.join(here, '..', 'fonts.css');

const header = `/**
 * GENERATED FILE — do not edit by hand.
 * Source of truth: fonts.config.mjs (run \`pnpm run genfonts\` to regenerate).
 *
 * Self-hosted Chinese faces for slides imported from PPTX. The importer passes
 * original font-family names through unchanged; a name renders here only if it
 * matches one of these families.
 *
 * Consumers import this once at the app shell:
 *     import '@praxis/renderer/fonts.css';
 *
 * 未配置 RENDERER_FONT_BASE_URL 时不声明任何 @font-face，导入的 PPTX 中这些字体回退系统字体。
 */`;

const blocks = FONT_CDN_BASE_URL
  ? FONT_FAMILIES.map(
      (family) => `@font-face {
  font-display: swap;
  font-family: '${family}';
  src: url('${fontUrl(family)}') format('woff2');
}`,
    ).join('\n')
  : '';

writeFileSync(outFile, FONT_CDN_BASE_URL ? `${header}\n${blocks}\n` : `${header}\n`);

if (FONT_CDN_BASE_URL) {
  console.log(
    `[genfonts] wrote ${FONT_FAMILIES.length} @font-face rules → fonts.css ` +
      `(${FONT_CDN_BASE_URL}/${FONT_DIR})`,
  );
} else {
  console.log(
    '[genfonts] RENDERER_FONT_BASE_URL is not configured; wrote header only → fonts.css',
  );
}
