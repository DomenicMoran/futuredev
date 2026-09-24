#!/usr/bin/env node
/**
 * Overwrite Android mipmap launcher assets from vector mark at exact dp sizes.
 * Legacy launcher: 48dp. Adaptive foreground: 108dp (Android upscales if too small).
 */
import { mkdirSync, unlinkSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { accent, onAccent, markSvg } from './icon-mark.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(__dirname, '..');
const resRoot = join(mobileRoot, 'android', 'app', 'src', 'main', 'res');

/** @type {{ folder: string; size: number }[]} */
const LEGACY_DENSITIES = [
  { folder: 'mipmap-mdpi', size: 48 },
  { folder: 'mipmap-hdpi', size: 72 },
  { folder: 'mipmap-xhdpi', size: 96 },
  { folder: 'mipmap-xxhdpi', size: 144 },
  { folder: 'mipmap-xxxhdpi', size: 192 },
];

/** Adaptive foreground — 108dp × density (mdpi 1× … xxxhdpi 4×). */
/** @type {{ folder: string; size: number }[]} */
const FOREGROUND_DENSITIES = [
  { folder: 'mipmap-mdpi', size: 108 },
  { folder: 'mipmap-hdpi', size: 162 },
  { folder: 'mipmap-xhdpi', size: 216 },
  { folder: 'mipmap-xxhdpi', size: 324 },
  { folder: 'mipmap-xxxhdpi', size: 432 },
];

const LAUNCHER_BASENAMES = ['ic_launcher', 'ic_launcher_round', 'ic_launcher_foreground'];

/**
 * @param {string} svg
 * @param {string} outPath
 * @param {number} size
 */
async function writePngFromSvg(svg, outPath, size) {
  await sharp(Buffer.from(svg))
    .resize(size, size, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toFile(outPath);
}

/** @param {string} dir */
function removeLegacyWebp(dir) {
  for (const base of LAUNCHER_BASENAMES) {
    const webp = join(dir, `${base}.webp`);
    if (existsSync(webp)) {
      unlinkSync(webp);
    }
  }
}

/** @returns {Promise<void>} */
export async function syncAndroidMipmaps() {
  for (const { folder, size } of LEGACY_DENSITIES) {
    const dir = join(resRoot, folder);
    mkdirSync(dir, { recursive: true });
    removeLegacyWebp(dir);

    const fullSvg = markSvg(size, { background: accent, foreground: onAccent });
    await writePngFromSvg(fullSvg, join(dir, 'ic_launcher.png'), size);
    await writePngFromSvg(fullSvg, join(dir, 'ic_launcher_round.png'), size);
    console.log(`sync-android-icons: ${folder} legacy (${size}px)`);
  }

  for (const { folder, size } of FOREGROUND_DENSITIES) {
    const dir = join(resRoot, folder);
    mkdirSync(dir, { recursive: true });
    const fgWebp = join(dir, 'ic_launcher_foreground.webp');
    if (existsSync(fgWebp)) {
      unlinkSync(fgWebp);
    }

    const fgSvg = markSvg(size, {
      background: accent,
      foreground: onAccent,
      transparentBg: false,
    });
    await writePngFromSvg(fgSvg, join(dir, 'ic_launcher_foreground.png'), size);
    console.log(`sync-android-icons: ${folder} foreground (${size}px)`);
  }
}

/**
 * Ascending-bar mark: center column crosses four separate white bar bands (not one F stem).
 * @returns {Promise<{ runs: number; sampleWidths: number[] }>}
 */
export async function verifyForegroundBars() {
  const fgPath = join(resRoot, 'mipmap-xxxhdpi', 'ic_launcher_foreground.png');
  const { data, info } = await sharp(fgPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const centerX = Math.floor(info.width / 2);
  let runs = 0;
  let inWhite = false;
  /** @type {number[]} */
  const barCentersY = [];

  for (let y = 0; y < info.height; y++) {
    const idx = (y * info.width + centerX) * info.channels;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const isWhite = r > 200 && g > 200 && b > 200;
    if (isWhite && !inWhite) {
      runs++;
      barCentersY.push(y);
    }
    inWhite = isWhite;
  }

  const sampleWidths = barCentersY.map((y) => {
    let left = centerX;
    let right = centerX;
    while (left > 0) {
      const i = (y * info.width + (left - 1)) * info.channels;
      if (data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200) left--;
      else break;
    }
    while (right < info.width - 1) {
      const i = (y * info.width + (right + 1)) * info.channels;
      if (data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200) right++;
      else break;
    }
    return right - left + 1;
  });

  return { runs, sampleWidths };
}

async function main() {
  await syncAndroidMipmaps();
  const meta = await sharp(join(resRoot, 'mipmap-xxxhdpi', 'ic_launcher_foreground.png')).metadata();
  console.log(`verify xxxhdpi foreground dimensions: ${meta.width}x${meta.height}`);
  if (meta.width !== 432 || meta.height !== 432) {
    throw new Error(`Expected 432x432 xxxhdpi foreground, got ${meta.width}x${meta.height}`);
  }

  const { runs, sampleWidths } = await verifyForegroundBars();
  console.log(
    `verify xxxhdpi foreground: center-column white runs=${runs}, bar widths=${sampleWidths.join(', ')}`,
  );
  if (runs !== 4) {
    throw new Error(`Expected 4 ascending bar bands on center column, got ${runs} runs (stale F stem?)`);
  }
  const monotonic = sampleWidths.every((w, i) => i === 0 || w >= sampleWidths[i - 1]);
  if (!monotonic) {
    throw new Error(`Bar widths should increase: ${sampleWidths.join(', ')}`);
  }
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1].replace(/\\/g, '/');
if (isCli || process.argv[1]?.endsWith('sync-android-icons.mjs')) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
