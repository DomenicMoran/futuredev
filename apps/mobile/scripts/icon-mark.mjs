/**
 * Ascending ladder mark — shared by make-icons and Android mipmap sync.
 */
import { colors } from '@futuredev/design-tokens';

export const accent = colors.light.accent;
export const onAccent = colors.light.accentText;

/**
 * @param {number} size
 * @param {{ background: string; foreground: string; transparentBg?: boolean }} opts
 */
export function markSvg(size, { background, foreground, transparentBg = false }) {
  const pad = size * 0.22;
  const gap = size * 0.045;
  const barH = size * 0.095;
  const rx = barH * 0.28;
  const stackH = 4 * barH + 3 * gap;
  const top0 = (size - stackH) / 2;
  const fracs = [0.42, 0.58, 0.74, 0.9];
  const maxW = size - pad * 2;

  const bars = fracs
    .map((frac, i) => {
      const w = maxW * frac;
      const x = (size - w) / 2;
      const y = top0 + i * (barH + gap);
      return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${barH.toFixed(2)}" rx="${rx.toFixed(2)}" fill="${foreground}" />`;
    })
    .join('\n  ');

  const bgRect = transparentBg
    ? ''
    : `<rect width="${size}" height="${size}" fill="${background}" />`;

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  ${bgRect}
  ${bars}
</svg>`;
}
