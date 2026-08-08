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
  'cite',
];

const ALLOWED_ATTRS = {
  a: ['href', 'target', 'rel'],
  img: ['src', 'alt', 'width', 'height', 'loading'],
  code: ['class'],
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan'],
  h1: ['id'], h2: ['id'], h3: ['id'], h4: ['id'],
};

const ALLOWED_SCHEMES = ['http', 'https', 'mailto'];

const ALLOWED_CLASSES = {
  div: ['pull-quote', 'stat-card', 'tip-note'],
  span: ['stat-value'],
};

export function sanitizeBlogHtml(html) {
  if (!html) return '';
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRS,
    allowedClasses: ALLOWED_CLASSES,
    allowedSchemes: ALLOWED_SCHEMES,
    enforceHtmlBoundary: false,
  });
}
