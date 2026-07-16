import { md } from '@/lib/markdown';
import { sanitizeBlogHtml } from '@/lib/sanitize-blog';

// A small number of older posts were stored as HTML before Markdown became the
// default. Detect those posts by their first block tag so they keep rendering
// correctly, while all other content goes through the Markdown renderer.
const LEGACY_HTML_START = /^<(?:article|aside|blockquote|div|figure|figcaption|h[1-6]|ol|p|pre|section|table|ul)(?:\s|>|\/)/i;

export function getBlogContentFormat(content) {
  return LEGACY_HTML_START.test((content || '').trim()) ? 'html' : 'markdown';
}

export function renderBlogContent(content) {
  if (!content) return '';

  const html = getBlogContentFormat(content) === 'html' ? content : md(content);

  // Sanitising the final HTML is important: Markdown rendering creates HTML,
  // so sanitising only the source would miss attributes created by the parser.
  return sanitizeBlogHtml(html);
}

export function serializeJsonLd(value) {
  // A literal "</script>" closes the script element even inside a JSON string.
  // Escaping every '<' keeps the JSON valid without creating HTML markup.
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
