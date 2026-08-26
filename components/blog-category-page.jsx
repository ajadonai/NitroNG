'use client';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter } from './shared-nav';
import { fD } from '@/lib/markdown';

export default function BlogCategoryView({ slug, label, h1, intro, posts, otherCategories }) {
  return <ThemeProvider><BlogCategoryInner slug={slug} label={label} h1={h1} intro={intro} posts={posts} otherCategories={otherCategories} /></ThemeProvider>;
}

function BlogCategoryInner({ slug, label, h1, intro, posts, otherCategories }) {
  const { dark, t } = useTheme();
  const accent = '#c47d8e';
  const cardBg = dark ? 'rgba(255,255,255,.05)' : '#fff';
  const border = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.04)';
  const thumbBg = dark ? '#111' : '#eee';
  const grd = dark ? 'linear-gradient(135deg, #2a1a22, #1a1225)' : 'linear-gradient(135deg, #e8d5db, #d4a8b5)';
  const chipBg = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.05)';
  const chipActive = dark ? 'rgba(196,125,142,.15)' : 'rgba(196,125,142,.1)';

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: t.bg, fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}>
      <SharedNav />

      <nav className="max-w-[900px] mx-auto w-full px-6 pt-8 max-md:pt-6" aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-[11px] list-none p-0 m-0" style={{ color: t.muted }}>
          <li><a href="/blog" className="no-underline hover:underline" style={{ color: t.muted }}>Blog</a></li>
          <li aria-hidden="true"><Chevron /></li>
          <li style={{ color: accent }}>{label}</li>
        </ol>
      </nav>

      <div className="text-center pt-6 pb-4 max-md:pt-4 px-6 max-w-[700px] mx-auto">
        <h1 className="text-[clamp(24px,4.5vw,36px)] font-semibold leading-tight" style={{ color: t.text, fontFamily: "'Cormorant Garamond',serif" }}>{h1}</h1>
        <p className="text-[15px] mt-2" style={{ color: t.muted }}>{posts.length} {posts.length === 1 ? 'article' : 'articles'}</p>
        {intro && <>
          <style>{`.cat-intro a{color:${accent};text-decoration:underline;text-underline-offset:2px}.cat-intro a:hover{opacity:.7}`}</style>
          <p className="cat-intro text-[15px] leading-[1.7] mt-5 text-left" style={{ color: t.muted }} dangerouslySetInnerHTML={{ __html: intro }} />
        </>}
      </div>

      {/* Topic chips */}
      <div className="flex flex-wrap justify-center gap-2 px-6 pb-8 max-w-[700px] mx-auto">
        <a href="/blog" className="py-1.5 px-3.5 rounded-full text-[11px] font-medium no-underline transition-colors" style={{ background: chipBg, color: t.muted }}>All</a>
        <span className="py-1.5 px-3.5 rounded-full text-[11px] font-medium" style={{ background: chipActive, color: accent, border: `1px solid ${dark ? 'rgba(196,125,142,.2)' : 'rgba(196,125,142,.15)'}` }}>{label}</span>
        {otherCategories.map(c => (
          <a key={c.slug} href={`/blog/${c.slug}`} className="py-1.5 px-3.5 rounded-full text-[11px] font-medium no-underline transition-colors hover:opacity-80" style={{ background: chipBg, color: t.muted }}>{c.label}</a>
        ))}
      </div>

      <main className="flex-1 px-6 pb-16 max-w-[900px] mx-auto w-full">
        <div className="grid grid-cols-3 max-[899px]:grid-cols-2 max-[599px]:grid-cols-1 gap-5">
          {posts.map(p => (
            <a key={p.slug} href={`/blog/${p.slug}`} className="no-underline group">
              <article className="rounded-xl overflow-hidden h-full flex flex-col transition-[box-shadow,transform] duration-200 group-hover:shadow-[0_8px_30px_rgba(0,0,0,.14)] group-hover:-translate-y-0.5" style={{ background: cardBg, border: `1px solid ${border}` }}>
                {p.thumbnail ? (
                  <div className="h-40 shrink-0" style={{ background: `url(${p.thumbnail}) center/cover no-repeat ${thumbBg}` }} />
                ) : (
                  <div className="h-40 shrink-0" style={{ background: grd }} />
                )}
                <div className="py-4 px-[18px] flex flex-col flex-1">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.8px] mb-[7px]" style={{ color: accent }}>{p.category}</div>
                  <h2 className="text-base font-semibold mb-1.5 leading-[1.3] m-0" style={{ color: t.text }}>{p.title}</h2>
                  <p className="text-sm leading-normal mb-2.5 line-clamp-2 m-0" style={{ color: t.muted }}>{p.excerpt}</p>
                  <div className="mt-auto text-xs" style={{ color: t.textFaint || (dark ? '#555' : '#aaa') }}>{p.authorName || 'Nitro Team'} · {fD(p.createdAt)}</div>
                </div>
              </article>
            </a>
          ))}
        </div>
      </main>

      <SharedFooter />
    </div>
  );
}

function Chevron() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>;
}
