import { beforeEach, describe, expect, it, vi } from 'vitest';

const prisma = {
  blogPost: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock('@/lib/prisma', () => ({ default: prisma }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn() } }));
vi.mock('@/lib/blog-values', () => ({
  getLiveValues: vi.fn().mockResolvedValue({}),
  injectLiveValues: vi.fn((content) => content || ''),
}));
vi.mock('@/components/blog-post', () => ({ default: () => null }));
vi.mock('next/navigation', () => ({ notFound: vi.fn() }));

const { default: BlogPostPage } = await import('@/app/blog/[slug]/page.jsx');
const { GET } = await import('@/app/api/blog/route.js');

function post(overrides = {}) {
  return {
    id: 'post-1',
    title: 'A safe title',
    slug: 'test-post',
    excerpt: 'An excerpt',
    content: '## Default content',
    category: 'Guides',
    thumbnail: null,
    published: true,
    showInHowTo: false,
    sortOrder: 1,
    authorName: 'Nitro Team',
    views: 10,
    createdAt: new Date('2026-07-01T10:00:00.000Z'),
    updatedAt: new Date('2026-07-02T10:00:00.000Z'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.blogPost.update.mockResolvedValue({});
});

describe('public blog rendering paths', () => {
  it('renders and sanitises Markdown before the article component receives it', async () => {
    prisma.blogPost.findFirst.mockResolvedValue(post({
      title: '</script><script>alert("metadata")</script>',
      content: '## Safe heading\n\n```js" onmouseover="alert(document.domain)\nhello\n```',
    }));

    const page = await BlogPostPage({ params: Promise.resolve({ slug: 'test-post' }) });
    const [articleJsonLd, breadcrumbJsonLd, article] = page.props.children;

    expect(article.props.post.content).toContain('<h2>Safe heading</h2>');
    expect(article.props.post.content).toContain('<pre><code>hello</code></pre>');
    expect(article.props.post.content).not.toContain('onmouseover');
    expect(article.props.post.content).not.toContain('alert(document.domain)');

    for (const script of [articleJsonLd, breadcrumbJsonLd]) {
      const json = script.props.dangerouslySetInnerHTML.__html;
      expect(json).not.toContain('<');
      expect(json).not.toContain('</script>');
      expect(() => JSON.parse(json)).not.toThrow();
    }
  });

  it('returns sanitised final HTML for a legacy HTML article through the single-post API', async () => {
    prisma.blogPost.findFirst.mockResolvedValue(post({
      slug: 'referral-program',
      content: '<h2>Referral guide</h2><p onclick="alert(1)">Existing article</p><script>steal()</script>',
    }));

    const response = await GET({ url: 'https://nitro.ng/api/blog?slug=referral-program' });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.post.content).toContain('<h2>Referral guide</h2>');
    expect(body.post.content).toContain('<p>Existing article</p>');
    expect(body.post.content).not.toContain('onclick');
    expect(body.post.content).not.toContain('<script');
    expect(body.post.content).not.toContain('steal');
  });
});
