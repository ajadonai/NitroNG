import sanitizeHtml from 'sanitize-html';

const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr',
  'ul', 'ol', 'li',
  'strong', 'em', 'b', 'i', 'u', 's', 'del',
  'a', 'img',
  'blockquote', 'pre', 'code',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'div', 'span',
  'sup', 'sub',
];

const ALLOWED_ATTRS = {
  a: ['href', 'target', 'rel'],
  img: ['src', 'alt', 'width', 'height', 'loading'],
  code: ['class'],
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan'],
};

const ALLOWED_SCHEMES = ['http', 'https', 'mailto'];

export function sanitizeBlogHtml(html) {
  if (!html) return '';
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRS,
    allowedSchemes: ALLOWED_SCHEMES,
    enforceHtmlBoundary: false,
  });
}
