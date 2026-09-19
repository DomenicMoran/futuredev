#!/usr/bin/env node
// Erzeugt icon.png (1024x1024), adaptive-icon.png und splash.png aus einer
// eigenen SVG (Buchstabe "F" aus zwei Formen in Akzentfarbe auf
// Hintergrundfarbe der Token), kein Stockbild, kein Emoji. Werte aus
// packages/design-tokens.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { colors } from '@futuredev/design-tokens';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(__dirname, '..', 'assets');
mkdirSync(assetsDir, { recursive: true });

const bg = colors.light.accent;
const fg = colors.light.accentText;

// Der Buchstabe "F" aus zwei Formen: einem senkrechten Balken und einem
// waagerechten Balken, in Akzent-Text-Farbe auf Akzentfläche.
function iconSvg(size, background) {
  const stroke = size * 0.16;
  const left = size * 0.32;
  const top = size * 0.24;
  const barLength = size * 0.42;
  const armLength = size * 0.3;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${background}" />
  <rect x="${left}" y="${top}" width="${stroke}" height="${barLength}" rx="${stroke * 0.2}" fill="${fg}" />
  <rect x="${left}" y="${top}" width="${armLength}" height="${stroke}" rx="${stroke * 0.2}" fill="${fg}" />
  <rect x="${left}" y="${top + barLength * 0.42}" width="${armLength * 0.78}" height="${stroke}" rx="${stroke * 0.2}" fill="${fg}" />
</svg>`;
}

async function render(svg, size, outPath) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(outPath);
  console.log(`make-icons: ${outPath} geschrieben (${size}x${size}).`);
}

async function main() {
  await render(iconSvg(1024, bg), 1024, join(assetsDir, 'icon.png'));
  await render(iconSvg(1024, bg), 1024, join(assetsDir, 'adaptive-icon.png'));

  // Splash: quadratisches Motiv mittig auf Token-Hintergrund, größere Leinwand.
  const splashSize = 1284;
  const motifSize = 420;
  const motif = await sharp(Buffer.from(iconSvg(motifSize, bg))).png().toBuffer();
  await sharp({
    create: {
      width: splashSize,
      height: splashSize,
      channels: 4,
      background: colors.light.bg,
    },
  })
    .composite([{ input: motif, gravity: 'center' }])
    .png()
    .toFile(join(assetsDir, 'splash.png'));
  console.log(`make-icons: ${join(assetsDir, 'splash.png')} geschrieben (${splashSize}x${splashSize}).`);

  writeFileSync(
    join(assetsDir, 'README.md'),
    'Icons und Splash sind mit scripts/make-icons.mjs aus einer eigenen SVG erzeugt (Buchstabe F, Token-Farben), kein Stockbild.\n',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
