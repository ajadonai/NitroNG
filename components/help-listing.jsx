'use client';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter } from './shared-nav';

export default function HelpListing({ articles }) {
  return <ThemeProvider><HelpListingInner articles={articles} /></ThemeProvider>;
}

function HelpListingInner({ articles }) {
  const { t } = useTheme();

  return (
    <div className="min-h-screen" style={{ background: t.bg, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
      <SharedNav />
      <div className="max-w-[680px] mx-auto" style={{ padding: "clamp(24px,4vw,40px) clamp(16px,3vw,24px) 48px" }}>
        <h1 className="font-semibold mb-2" style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "clamp(24px,5vw,34px)", color: t.text }}>Help Centre</h1>
        <p className="mb-8 text-sm leading-relaxed" style={{ color: t.muted }}>Guides on placing orders, adding funds, understanding tiers, and everything else you need to use Nitro.</p>
        <div className="flex flex-col gap-3">
          {articles.map(a => (
            <a key={a.slug} href={`/help/${a.slug}`} className="block p-4 rounded-lg no-underline" style={{ border: '1px solid ' + t.surfaceBrd, background: t.surface }}>
              <div className="font-medium text-sm mb-1" style={{ color: t.text }}>{a.title}</div>
              {a.excerpt && <div className="text-xs leading-relaxed" style={{ color: t.muted }}>{a.excerpt}</div>}
            </a>
          ))}
          {articles.length === 0 && <p className="text-sm" style={{ color: t.muted }}>No help articles found.</p>}
        </div>
      </div>
      <SharedFooter />
    </div>
  );
}
