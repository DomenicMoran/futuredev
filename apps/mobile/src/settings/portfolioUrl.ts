/** A blank portfolio link is allowed; non-blank values must be absolute web URLs. */
export function isValidPortfolioUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  const authority = /^https?:\/\/([^/?#]+)/i.exec(trimmed)?.[1];
  if (!authority) return false;
  try {
    const url = new URL(trimmed);
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname.length > 0 && !url.username && !url.password;
  } catch {
    return false;
  }
}
