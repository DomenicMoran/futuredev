#!/usr/bin/env node
/**
 * Overwrite Android mipmap launcher WEBPs from Expo assets.
 * Expo icon.png does not refresh prebuilt native mipmaps — run after make-icons.
 */
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(__dirname, '..');
const assetsDir = join(mobileRoot, 'assets');
const resRoot = join(mobileRoot, 'android', 'app', 'src', 'main', 'res');

const WEBP_QUALITY = 90;

/** @type {{ folder: string; size: number }[]} */
const DENSITIES = [
  { folder: 'mipmap-mdpi', size: 48 },
  { folder: 'mipmap-hdpi', size: 72 },
  { folder: 'mipmap-xhdpi', size: 96 },
  { folder: 'mipmap-xxhdpi', size: 144 },
  { folder: 'mipmap-xxxhdpi', size: 192 },
];

async function writeWebp(sourcePath, outPath, size) {
  await sharp(sourcePath)
    .resize(size, size, { fit: 'fill' })
    .webp({ quality: WEBP_QUALITY })
    .toFile(outPath);
}

/** @returns {Promise<void>} */
export async function syncAndroidMipmaps() {
  const iconPath = join(assetsDir, 'icon.png');
  const adaptivePath = join(assetsDir, 'adaptive-icon.png');

  for (const { folder, size } of DENSITIES) {
    const dir = join(resRoot, folder);
    mkdirSync(dir, { recursive: true });
    await writeWebp(iconPath, join(dir, 'ic_launcher.webp'), size);
    await writeWebp(iconPath, join(dir, 'ic_launcher_round.webp'), size);
    await writeWebp(adaptivePath, join(dir, 'ic_launcher_foreground.webp'), size);
    console.log(`sync-android-icons: ${folder} (${size}px)`);
  }
}

/**
 * Ascending-bar mark: center column crosses four separate white bar bands (not one F stem).
 * @returns {Promise<{ runs: number; sampleWidths: number[] }>}
 */
export async function verifyForegroundBars() {
  const fgPath = join(resRoot, 'mipmap-xxxhdpi', 'ic_launcher_foreground.webp');
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
