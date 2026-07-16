import { describe, it, expect } from 'vitest';
import { sanitizeBlogHtml } from '@/lib/sanitize-blog';
import { getBlogContentFormat, renderBlogContent, serializeJsonLd } from '@/lib/blog-rendering';
import { md } from '@/lib/markdown';

describe('blog HTML sanitisation', () => {
  describe('sanitizeBlogHtml', () => {
    it('removes script tags', () => {
      const html = '<p>Hello</p><script>alert("xss")</script><p>World</p>';
      const result = sanitizeBlogHtml(html);
      expect(result).not.toContain('<script');
      expect(result).not.toContain('alert');
      expect(result).toContain('<p>Hello</p>');
      expect(result).toContain('<p>World</p>');
    });

    it('removes event handler attributes', () => {
      const html = '<img src="x" onerror="alert(1)" /><div onclick="steal()">click</div>';
      const result = sanitizeBlogHtml(html);
      expect(result).not.toContain('onerror');
      expect(result).not.toContain('onclick');
      expect(result).not.toContain('alert');
      expect(result).not.toContain('steal');
    });

    it('removes javascript: URLs', () => {
      const html = '<a href="javascript:alert(1)">click me</a>';
      const result = sanitizeBlogHtml(html);
      expect(result).not.toContain('javascript:');
    });

    it('removes iframe, object, embed tags', () => {
      const html = '<iframe src="https://evil.com"></iframe><object data="x"></object><embed src="y">';
      const result = sanitizeBlogHtml(html);
      expect(result).not.toContain('<iframe');
      expect(result).not.toContain('<object');
      expect(result).not.toContain('<embed');
    });

    it('removes style tags', () => {
      const html = '<style>body{display:none}</style><p>content</p>';
      const result = sanitizeBlogHtml(html);
      expect(result).not.toContain('<style');
      expect(result).toContain('<p>content</p>');
    });

    it('preserves safe formatting tags', () => {
      const html = '<h2>Title</h2><p>Text with <strong>bold</strong> and <em>italic</em></p><ul><li>item</li></ul>';
      const result = sanitizeBlogHtml(html);
      expect(result).toContain('<h2>Title</h2>');
      expect(result).toContain('<strong>bold</strong>');
      expect(result).toContain('<em>italic</em>');
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>item</li>');
    });

    it('preserves safe links', () => {
      const html = '<a href="https://nitro.ng/blog" target="_blank" rel="noopener noreferrer">Nitro Blog</a>';
      const result = sanitizeBlogHtml(html);
      expect(result).toContain('href="https://nitro.ng/blog"');
      expect(result).toContain('target="_blank"');
    });

    it('preserves tables', () => {
      const html = '<table><thead><tr><th>Col</th></tr></thead><tbody><tr><td>Data</td></tr></tbody></table>';
      const result = sanitizeBlogHtml(html);
      expect(result).toContain('<table>');
      expect(result).toContain('<th>Col</th>');
      expect(result).toContain('<td>Data</td>');
    });

    it('preserves blockquotes', () => {
      const html = '<blockquote><p>A quote</p></blockquote>';
      const result = sanitizeBlogHtml(html);
      expect(result).toContain('<blockquote>');
      expect(result).toContain('A quote');
    });

    it('preserves code blocks', () => {
      const html = '<pre><code class="language-js">const x = 1;</code></pre>';
      const result = sanitizeBlogHtml(html);
      expect(result).toContain('<pre>');
      expect(result).toContain('<code');
      expect(result).toContain('const x = 1;');
    });

    it('handles empty input', () => {
      expect(sanitizeBlogHtml('')).toBe('');
      expect(sanitizeBlogHtml(null)).toBe('');
      expect(sanitizeBlogHtml(undefined)).toBe('');
    });
  });

  describe('md() markdown renderer', () => {
    it('renders markdown formatting correctly', () => {
      const result = md('## Heading\n\nSome **bold** and *italic* text.\n\n- item 1\n- item 2');
      expect(result).toContain('<h2>Heading</h2>');
      expect(result).toContain('<strong>bold</strong>');
      expect(result).toContain('<em>italic</em>');
      expect(result).toContain('<li>item 1</li>');
    });

    it('escapes HTML in markdown content instead of passing it through', () => {
      const result = md('<script>alert("xss")</script>');
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    it('escapes raw HTML tags that start the content', () => {
      const result = md('<div><img onerror="alert(1)" src="x">bad</div>');
      expect(result).not.toContain('<img');
      expect(result).toContain('&lt;');
    });

    it('renders links with safe URLs', () => {
      const result = md('[Nitro](https://nitro.ng)');
      expect(result).toContain('href="https://nitro.ng"');
    });

    it('rejects javascript: URLs in links', () => {
      const result = md('[click](javascript:alert(1))');
      expect(result).not.toContain('javascript:');
      expect(result).not.toContain('href');
    });
  });

  describe('end-to-end: sanitize(md(content))', () => {
    it('double defence removes malicious content starting with HTML', () => {
      const malicious = '<div><script>document.cookie</script><img onerror="alert(1)">real content</div>';
      const rendered = md(malicious);
      const sanitized = sanitizeBlogHtml(rendered);
      expect(sanitized).not.toContain('<script');
      expect(sanitized).not.toContain('<img');
    });
  });

  describe('server rendering pipeline', () => {
    it('renders Markdown before sanitising the final HTML', () => {
      const result = renderBlogContent('## Heading\n\nSome **bold** text.');

      expect(result).toContain('<h2>Heading</h2>');
      expect(result).toContain('<strong>bold</strong>');
    });

    it('does not let a code-fence language create an event attribute', () => {
      const result = renderBlogContent('```js" onmouseover="alert(document.domain)\nhello\n```');

      expect(result).toContain('<pre><code>hello</code></pre>');
      expect(result).not.toContain('onmouseover');
      expect(result).not.toContain('alert');
    });

    it('preserves safe legacy HTML while removing executable content', () => {
      const legacy = '<h2>Existing guide</h2><p onclick="alert(1)">Useful text</p><script>steal()</script>';
      const result = renderBlogContent(legacy);

      expect(getBlogContentFormat(legacy)).toBe('html');
      expect(result).toContain('<h2>Existing guide</h2>');
      expect(result).toContain('<p>Useful text</p>');
      expect(result).not.toContain('onclick');
      expect(result).not.toContain('<script');
      expect(result).not.toContain('steal');
    });

    it('serialises JSON-LD without a script-closing sequence', () => {
      const result = serializeJsonLd({ title: '</script><script>alert(1)</script>' });

      expect(result).not.toContain('<');
      expect(result).not.toContain('</script>');
      expect(result).toContain('\\u003c/script>');
      expect(JSON.parse(result).title).toBe('</script><script>alert(1)</script>');
    });
  });
});
