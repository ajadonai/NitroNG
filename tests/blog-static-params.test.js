import { Prisma } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prisma = {
  blogPost: {
    findMany: vi.fn(),
  },
};

vi.mock('@/lib/prisma', () => ({ default: prisma }));
vi.mock('@/lib/blog-values', () => ({
  getLiveValues: vi.fn(),
  injectLiveValues: vi.fn(),
}));
vi.mock('@/components/blog-post', () => ({ default: () => null }));
vi.mock('@/components/blog-category-page', () => ({ default: () => null }));
vi.mock('next/navigation', () => ({ notFound: vi.fn() }));

const { generateStaticParams } = await import('@/app/blog/[slug]/page.jsx');
const { default: BLOG_CATEGORIES } = await import('@/lib/blog-categories');

let warnSpy;

beforeEach(() => {
  vi.clearAllMocks();
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  warnSpy.mockRestore();
});

describe('blog generateStaticParams', () => {
  it('returns published post slugs followed by every category slug', async () => {
    prisma.blogPost.findMany.mockResolvedValue([
      { slug: 'first-post' },
      { slug: 'second-post' },
    ]);

    await expect(generateStaticParams()).resolves.toEqual([
      { slug: 'first-post' },
      { slug: 'second-post' },
      ...Object.keys(BLOG_CATEGORIES).map(slug => ({ slug })),
    ]);
    expect(prisma.blogPost.findMany).toHaveBeenCalledWith({
      where: { published: true, NOT: { category: 'Help' } },
      select: { slug: true },
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('returns no static paths when P1001 persists after retries', async () => {
    vi.useFakeTimers();
    const unavailable = Object.assign(new Error('Database server is unreachable'), {
      code: 'P1001',
    });
    prisma.blogPost.findMany.mockRejectedValue(unavailable);

    const params = generateStaticParams();
    await vi.runAllTimersAsync();

    await expect(params).resolves.toEqual([]);
    expect(prisma.blogPost.findMany).toHaveBeenCalledTimes(3);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('returns no static paths for the initialization error emitted by an unreachable database', async () => {
    const unavailable = new Prisma.PrismaClientInitializationError(
      "Can't reach database server at `database.nitro.invalid:5432`",
      Prisma.prismaVersion.client,
    );
    prisma.blogPost.findMany.mockRejectedValue(unavailable);

    await expect(generateStaticParams()).resolves.toEqual([]);
    expect(prisma.blogPost.findMany).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('recognizes Prisma variants that expose P1001 as errorCode', async () => {
    const unavailable = Object.assign(new Error('Database server is unreachable'), {
      errorCode: 'P1001',
    });
    prisma.blogPost.findMany.mockRejectedValue(unavailable);

    await expect(generateStaticParams()).resolves.toEqual([]);
    expect(prisma.blogPost.findMany).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('does not hide unrelated Prisma initialization failures', async () => {
    const invalidConfiguration = new Prisma.PrismaClientInitializationError(
      'Failed to parse the database connection configuration',
      Prisma.prismaVersion.client,
    );
    prisma.blogPost.findMany.mockRejectedValue(invalidConfiguration);

    await expect(generateStaticParams()).rejects.toBe(invalidConfiguration);
    expect(prisma.blogPost.findMany).toHaveBeenCalledOnce();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does not hide unrelated query or programming errors', async () => {
    const programmingError = new TypeError('Cannot read properties of undefined');
    prisma.blogPost.findMany.mockRejectedValue(programmingError);

    await expect(generateStaticParams()).rejects.toBe(programmingError);
    expect(prisma.blogPost.findMany).toHaveBeenCalledOnce();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
