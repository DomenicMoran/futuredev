#!/usr/bin/env node
// Erzeugt Modul-Cover M01–M10 als PNG aus eigenen SVG-Motiven (Token-Farben,
// kein Stockbild, keine bezahlte Bild-API). Analog zu scripts/make-icons.mjs.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { colors } from '@futuredev/design-tokens';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'assets', 'illustrations');
mkdirSync(outDir, { recursive: true });

const SIZE = 320;
const bg = colors.light.bg;
const accent = colors.light.accent;
const accentSoft = '#D6E4FF';
const ink = colors.light.textWeak;

/** @type {Record<string, (s: number) => string>} */
const motifs = {
  M01: chipMotif,
  M02: browserMotif,
  M03: layersMotif,
  M04: pipelineMotif,
  M05: phoneMotif,
  M06: shieldMotif,
  M07: chartMotif,
  M08: nodesMotif,
  M09: toolsMotif,
  M10: starMotif,
};

function wrap(size, inner) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${size * 0.12}" fill="${bg}" />
  <rect x="${size * 0.08}" y="${size * 0.08}" width="${size * 0.84}" height="${size * 0.84}" rx="${size * 0.1}" fill="${accentSoft}" />
  ${inner}
</svg>`;
}

function chipMotif(s) {
  const cx = s * 0.5;
  const cy = s * 0.5;
  const w = s * 0.34;
  const h = s * 0.34;
  const pins = Array.from({ length: 4 }, (_, i) => {
    const x = cx - w / 2 + (w / 3) * i;
    return `<rect x="${x - s * 0.015}" y="${cy - h / 2 - s * 0.05}" width="${s * 0.03}" height="${s * 0.05}" rx="2" fill="${accent}" />`;
  }).join('');
  return wrap(
    s,
    `${pins}<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="${s * 0.04}" fill="${accent}" />
    <rect x="${cx - w * 0.25}" y="${cy - h * 0.25}" width="${w * 0.5}" height="${h * 0.5}" rx="${s * 0.02}" fill="${accentSoft}" />`,
  );
}

function browserMotif(s) {
  const x = s * 0.22;
  const y = s * 0.28;
  const w = s * 0.56;
  const h = s * 0.44;
  return wrap(
    s,
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${s * 0.04}" fill="${accent}" />
    <rect x="${x}" y="${y}" width="${w}" height="${h * 0.18}" rx="${s * 0.04}" fill="${ink}" opacity="0.25" />
    <circle cx="${x + s * 0.06}" cy="${y + h * 0.09}" r="${s * 0.018}" fill="#fff" />
    <circle cx="${x + s * 0.11}" cy="${y + h * 0.09}" r="${s * 0.018}" fill="#fff" opacity="0.7" />
    <rect x="${x + s * 0.06}" y="${y + h * 0.32}" width="${w * 0.7}" height="${s * 0.04}" rx="3" fill="#fff" opacity="0.9" />
    <rect x="${x + s * 0.06}" y="${y + h * 0.48}" width="${w * 0.5}" height="${s * 0.04}" rx="3" fill="#fff" opacity="0.6" />`,
  );
}

function layersMotif(s) {
  const layers = [0.62, 0.5, 0.38].map((scale, i) => {
    const w = s * scale;
    const h = s * 0.12;
    const x = (s - w) / 2;
    const y = s * 0.32 + i * s * 0.14;
    const fill = i === 0 ? accent : i === 1 ? ink : accentSoft;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${s * 0.03}" fill="${fill}" opacity="${i === 2 ? 1 : 0.85}" />`;
  });
  return wrap(s, layers.join(''));
}

function pipelineMotif(s) {
  const y = s * 0.46;
  const nodes = [0.28, 0.5, 0.72].map((fx, i) => {
    const cx = s * fx;
    const r = s * 0.07;
    const fill = i === 1 ? accent : accentSoft;
    return `<circle cx="${cx}" cy="${y}" r="${r}" fill="${fill}" stroke="${accent}" stroke-width="${s * 0.012}" />`;
  });
  return wrap(
    s,
    `<line x1="${s * 0.35}" y1="${y}" x2="${s * 0.43}" y2="${y}" stroke="${accent}" stroke-width="${s * 0.025}" />
    <line x1="${s * 0.57}" y1="${y}" x2="${s * 0.65}" y2="${y}" stroke="${accent}" stroke-width="${s * 0.025}" />
    ${nodes.join('')}`,
  );
}

function phoneMotif(s) {
  const w = s * 0.28;
  const h = s * 0.48;
  const x = (s - w) / 2;
  const y = s * 0.26;
  return wrap(
    s,
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${s * 0.04}" fill="${accent}" />
    <rect x="${x + w * 0.12}" y="${y + h * 0.1}" width="${w * 0.76}" height="${h * 0.7}" rx="${s * 0.02}" fill="#fff" opacity="0.95" />
    <circle cx="${s * 0.5}" cy="${y + h * 0.92}" r="${s * 0.02}" fill="#fff" opacity="0.8" />`,
  );
}

function shieldMotif(s) {
  const cx = s * 0.5;
  const top = s * 0.24;
  const path = `M ${cx} ${top} L ${s * 0.72} ${s * 0.32} L ${s * 0.68} ${s * 0.62} L ${cx} ${s * 0.74} L ${s * 0.32} ${s * 0.62} L ${s * 0.28} ${s * 0.32} Z`;
  return wrap(
    s,
    `<path d="${path}" fill="${accent}" />
    <path d="M ${cx} ${s * 0.38} L ${s * 0.58} ${s * 0.48} L ${s * 0.54} ${s * 0.58} L ${cx} ${s * 0.52} L ${s * 0.46} ${s * 0.58} L ${s * 0.42} ${s * 0.48} Z" fill="#fff" opacity="0.9" />`,
  );
}

function chartMotif(s) {
  const base = s * 0.68;
  const bars = [
    [0.32, 0.22],
    [0.44, 0.38],
    [0.56, 0.3],
    [0.68, 0.46],
  ].map(([fx, fh]) => {
    const bw = s * 0.08;
    const bh = s * fh;
    const x = s * fx - bw / 2;
    const y = base - bh;
    return `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="${s * 0.02}" fill="${accent}" opacity="0.85" />`;
  });
  return wrap(s, `${bars.join('')}<line x1="${s * 0.26}" y1="${base}" x2="${s * 0.74}" y2="${base}" stroke="${ink}" stroke-width="${s * 0.02}" opacity="0.35" />`);
}

function nodesMotif(s) {
  const pts = [
    [0.5, 0.32],
    [0.32, 0.52],
    [0.68, 0.52],
    [0.4, 0.68],
    [0.6, 0.68],
  ];
  const lines = [
    [0, 1],
    [0, 2],
    [1, 3],
    [2, 4],
    [3, 4],
  ]
    .map(([a, b]) => {
      const [x1, y1] = pts[a];
      const [x2, y2] = pts[b];
      return `<line x1="${s * x1}" y1="${s * y1}" x2="${s * x2}" y2="${s * y2}" stroke="${accent}" stroke-width="${s * 0.018}" opacity="0.5" />`;
    })
    .join('');
  const dots = pts
    .map(([fx, fy], i) => {
      const r = i === 0 ? s * 0.07 : s * 0.055;
      const fill = i === 0 ? accent : accentSoft;
      return `<circle cx="${s * fx}" cy="${s * fy}" r="${r}" fill="${fill}" stroke="${accent}" stroke-width="${s * 0.012}" />`;
    })
    .join('');
  return wrap(s, `${lines}${dots}`);
}

function toolsMotif(s) {
  const cx = s * 0.5;
  const cy = s * 0.5;
  return wrap(
    s,
    `<rect x="${s * 0.26}" y="${s * 0.34}" width="${s * 0.48}" height="${s * 0.3}" rx="${s * 0.05}" fill="${accentSoft}" stroke="${accent}" stroke-width="${s * 0.015}" />
    <rect x="${s * 0.3}" y="${s * 0.38}" width="${s * 0.14}" height="${s * 0.08}" rx="3" fill="${accent}" />
    <rect x="${s * 0.48}" y="${s * 0.38}" width="${s * 0.2}" height="${s * 0.08}" rx="3" fill="${accent}" opacity="0.7" />
    <circle cx="${cx}" cy="${cy + s * 0.12}" r="${s * 0.045}" fill="none" stroke="${accent}" stroke-width="${s * 0.025}" />
    <line x1="${cx - s * 0.08}" y1="${cy - s * 0.02}" x2="${cx + s * 0.08}" y2="${cy - s * 0.02}" stroke="${accent}" stroke-width="${s * 0.025}" stroke-linecap="round" />`,
  );
}

function starMotif(s) {
  const cx = s * 0.5;
  const cy = s * 0.48;
  const outer = s * 0.2;
  const inner = s * 0.08;
  const points = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 2) * -1 + (i * Math.PI) / 5;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(' ');
  return wrap(s, `<polygon points="${points}" fill="${accent}" />`);
}

async function main() {
  for (const [id, fn] of Object.entries(motifs)) {
    const svg = fn(SIZE);
    const outPath = join(outDir, `${id}.png`);
    await sharp(Buffer.from(svg)).png().toFile(outPath);
    console.log(`make-illustrations: ${outPath}`);
  }

  const onboardingSvg = wrap(
    SIZE,
    `<circle cx="${SIZE * 0.5}" cy="${SIZE * 0.42}" r="${SIZE * 0.14}" fill="${accent}" />
    <rect x="${SIZE * 0.32}" y="${SIZE * 0.58}" width="${SIZE * 0.36}" height="${SIZE * 0.08}" rx="4" fill="${accentSoft}" stroke="${accent}" stroke-width="2" />
    <rect x="${SIZE * 0.38}" y="${SIZE * 0.7}" width="${SIZE * 0.24}" height="${SIZE * 0.06}" rx="3" fill="${accent}" opacity="0.5" />`,
  );
  await sharp(Buffer.from(onboardingSvg)).png().toFile(join(outDir, 'onboarding.png'));
  console.log(`make-illustrations: ${join(outDir, 'onboarding.png')}`);

  writeFileSync(
    join(outDir, 'README.md'),
    'Modul-Cover und Onboarding-Bild mit scripts/make-illustrations.mjs aus eigenen SVG erzeugt (Token-Farben), kein Stockbild.\n',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
