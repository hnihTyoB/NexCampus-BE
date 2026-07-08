export function toSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function urlToPageSlug(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const segment = pathname.split('/').filter(Boolean).pop() || 'home';
    const slug = toSlug(segment);
    return slug || 'page';
  } catch {
    return 'page';
  }
}

export function generatePageFileName(
  index: number,
  url: string,
  ext: string,
): string {
  const slug = urlToPageSlug(url);
  const prefix = String(index + 1).padStart(3, '0');
  return `${prefix}-${slug}.${ext}`;
}
