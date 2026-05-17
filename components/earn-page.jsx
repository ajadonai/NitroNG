'use client';
import { useState, useEffect, useCallback } from 'react';
import Game2048 from './game-2048';

const TABS = [
  { id: 'game', label: '2048', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
  { id: 'video', label: 'Watch & Earn', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> },
];

const MEDALS = ['🥇', '🥈', '🥉'];

export default function EarnPage({ dark, t }) {
  const [tab, setTab] = useState('game');
  const [lb, setLb] = useState(null);
  const [videoStatus, setVideoStatus] = useState(null);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch('/api/earn/leaderboard');
      if (res.ok) setLb(await res.json());
    } catch {}
  }, []);

  const fetchVideoStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/earn/video/status');
      if (res.ok) setVideoStatus(await res.json());
    } catch {}
  }, []);

  useEffect(() => { fetchLeaderboard(); fetchVideoStatus(); }, [fetchLeaderboard, fetchVideoStatus]);

  const monthLabel = lb?.monthKey
    ? new Date(lb.monthKey + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';

  const gradBg = dark
    ? 'linear-gradient(135deg, rgba(196,125,142,.12) 0%, rgba(107,58,74,.15) 100%)'
    : 'linear-gradient(135deg, rgba(196,125,142,.1) 0%, rgba(163,88,107,.08) 100%)';
  const gradBorder = dark ? 'rgba(196,125,142,.2)' : 'rgba(196,125,142,.15)';

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1.5 p-1 rounded-xl" style={{ background: dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.03)' }}>
        {TABS.map(tb => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className="flex-1 py-2.5 rounded-lg text-[13px] font-semibold border-none cursor-pointer transition-all flex items-center justify-center gap-1.5"
            style={{
              background: tab === tb.id ? (dark ? 'rgba(196,125,142,.14)' : '#fff') : 'transparent',
              color: tab === tb.id ? (dark ? t.accent : t.text) : t.textMuted,
              boxShadow: tab === tb.id ? (dark ? '0 0 0 1px rgba(196,125,142,.25)' : '0 1px 4px rgba(0,0,0,.08)') : 'none',
            }}
          >
            {tb.icon}{tb.label}
          </button>
        ))}
      </div>

      {/* ── GAME TAB ── */}
      {tab === 'game' && (
        <div className="space-y-4">
          {/* Game card */}
          <div className="p-5 max-md:p-4 rounded-2xl" style={{ background: dark ? 'rgba(255,255,255,.04)' : '#fff', border: `0.5px solid ${t.cardBorder}` }}>
            <Game2048 dark={dark} t={t} onScoreSubmitted={fetchLeaderboard} />
          </div>

          {/* ── PRIZE POOL ── */}
          <div className="rounded-2xl overflow-hidden relative" style={{ background: gradBg, border: `1px solid ${gradBorder}` }}>
            {/* Decorative glow */}
            <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-20 blur-2xl" style={{ background: t.accent }} />
            <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full opacity-15 blur-2xl" style={{ background: t.accent }} />

            {/* Header */}
            <div className="relative px-5 pt-4 pb-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${t.accent}, ${dark ? '#6b3a4a' : '#8b5e6b'})`, boxShadow: '0 4px 12px rgba(196,125,142,.3)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              </div>
              <div className="flex-1">
                <div className="text-[14px] font-bold" style={{ color: t.text }}>Monthly Prize Pool</div>
                <div className="text-[11px] font-medium" style={{ color: t.textMuted }}>{monthLabel || 'This month'} — Top 5 win cash</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: t.accent }}>Total</div>
                <div className="text-lg font-bold" style={{ color: t.accent }}>₦10,500</div>
              </div>
            </div>

            {/* Prize slots */}
            <div className="relative px-4 pb-4 grid grid-cols-5 gap-1.5">
              {[
                { rank: '1st', amount: '₦5,000', medal: '🥇', top: true },
                { rank: '2nd', amount: '₦3,000', medal: '🥈' },
                { rank: '3rd', amount: '₦1,500', medal: '🥉' },
                { rank: '4th', amount: '₦1,000' },
                { rank: '5th', amount: '₦500' },
              ].map((p, i) => (
                <div key={i} className="flex flex-col items-center py-2.5 rounded-xl" style={{
                  background: p.top
                    ? (dark ? 'rgba(196,125,142,.18)' : 'rgba(196,125,142,.12)')
                    : (dark ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.6)'),
                  border: `1px solid ${p.top ? (dark ? 'rgba(196,125,142,.3)' : 'rgba(196,125,142,.2)') : (dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)')}`,
                }}>
                  <span className="text-sm leading-none">{p.medal || <span className="text-[10px] font-bold" style={{ color: t.textMuted }}>{p.rank}</span>}</span>
                  <span className="text-[10px] font-bold mt-1" style={{ color: p.top ? t.accent : t.text }}>{p.amount}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── LEADERBOARD ── */}
          <div className="rounded-2xl overflow-hidden" style={{ background: dark ? 'rgba(255,255,255,.04)' : '#fff', border: `0.5px solid ${t.cardBorder}` }}>
            {/* LB Header */}
            <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: `1px solid ${dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)'}` }}>
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2" strokeLinecap="round"><path d="M8 21V12H2v9h6zM22 21V8h-6v13h6zM15 21V4H9v17h6z"/></svg>
                <span className="text-[13px] font-bold" style={{ color: t.text }}>Leaderboard</span>
              </div>
              {lb?.userRank && (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg" style={{ background: `linear-gradient(135deg, ${dark ? 'rgba(196,125,142,.15)' : 'rgba(196,125,142,.1)'}, ${dark ? 'rgba(107,58,74,.2)' : 'rgba(163,88,107,.08)'})`, color: t.accent, border: `1px solid ${dark ? 'rgba(196,125,142,.25)' : 'rgba(196,125,142,.12)'}` }}>
                  Your rank: #{lb.userRank}
                </span>
              )}
            </div>

            {lb?.leaderboard?.length > 0 ? (
              <>
                {/* Top 3 podium */}
                {lb.leaderboard.filter(e => e.rank <= 3).length > 0 && (
                  <div className="px-4 pt-4 pb-2 flex items-end justify-center gap-2">
                    {[2, 1, 3].map(rank => {
                      const entry = lb.leaderboard.find(e => e.rank === rank);
                      if (!entry) return <div key={rank} className="w-[30%]" />;
                      const isFirst = rank === 1;
                      return (
                        <div key={rank} className="flex flex-col items-center" style={{ width: '30%' }}>
                          <span className="text-lg mb-1">{MEDALS[rank - 1]}</span>
                          <div
                            className="w-full rounded-xl flex flex-col items-center justify-center"
                            style={{
                              height: isFirst ? 90 : rank === 2 ? 72 : 60,
                              background: isFirst
                                ? (dark ? 'linear-gradient(180deg, rgba(196,125,142,.2), rgba(196,125,142,.08))' : 'linear-gradient(180deg, rgba(196,125,142,.12), rgba(196,125,142,.04))')
                                : (dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.02)'),
                              border: `1px solid ${isFirst ? (dark ? 'rgba(196,125,142,.3)' : 'rgba(196,125,142,.15)') : (dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.05)')}`,
                            }}
                          >
                            <span className="text-[12px] font-bold truncate max-w-[90%]" style={{ color: entry.isYou ? t.accent : t.text }}>
                              {entry.isYou ? 'You' : entry.name.split(' ')[0]}
                            </span>
                            <span className="text-[11px] font-bold mt-0.5 tabular-nums" style={{ color: t.textMuted }}>{entry.score.toLocaleString()}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Rest of leaderboard */}
                {lb.leaderboard.filter(e => e.rank > 3).length > 0 && (
                  <div className="px-3 pb-2 pt-1">
                    {lb.leaderboard.filter(e => e.rank > 3).map((entry, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-3 py-2 rounded-lg"
                        style={{
                          background: entry.isYou ? (dark ? 'rgba(196,125,142,.1)' : 'rgba(196,125,142,.05)') : 'transparent',
                          border: entry.isYou ? `1px solid ${dark ? 'rgba(196,125,142,.2)' : 'rgba(196,125,142,.1)'}` : '1px solid transparent',
                          marginBottom: 1,
                        }}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-[11px] font-bold w-5 text-center" style={{ color: t.textMuted }}>{entry.rank}</span>
                          <span className="text-[13px] font-medium" style={{ color: entry.isYou ? t.accent : t.text }}>
                            {entry.isYou ? 'You' : entry.name}
                          </span>
                        </div>
                        <span className="text-[12px] font-bold tabular-nums" style={{ color: t.text }}>{entry.score.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="px-5 py-12 text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: gradBg, border: `1px solid ${gradBorder}` }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="1.5" strokeLinecap="round"><path d="M8 21V12H2v9h6zM22 21V8h-6v13h6zM15 21V4H9v17h6z"/></svg>
                </div>
                <div className="text-sm font-bold" style={{ color: t.text }}>No scores yet</div>
                <div className="text-xs mt-1" style={{ color: t.textMuted }}>Play a game to claim the #1 spot!</div>
              </div>
            )}
          </div>

          {/* Past winners */}
          {lb?.pastWinners?.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ background: dark ? 'rgba(255,255,255,.04)' : '#fff', border: `0.5px solid ${t.cardBorder}` }}>
              <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: `1px solid ${dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)'}` }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2" strokeLinecap="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                <span className="text-[13px] font-bold" style={{ color: t.text }}>Hall of Fame</span>
              </div>
              <div className="px-3 py-2">
                {lb.pastWinners.filter(w => w.rank === 1).map((w, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2.5 rounded-lg" style={{ marginBottom: 2 }}>
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm">🏆</span>
                      <div>
                        <div className="text-[13px] font-semibold" style={{ color: t.text }}>{w.name}</div>
                        <div className="text-[10px] font-medium" style={{ color: t.textMuted }}>
                          {new Date(w.monthKey + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} — {w.score.toLocaleString()} pts
                        </div>
                      </div>
                    </div>
                    <span className="text-[12px] font-bold px-2 py-0.5 rounded-md" style={{ background: dark ? 'rgba(196,125,142,.12)' : 'rgba(196,125,142,.08)', color: t.accent }}>₦{(w.amount / 100).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── VIDEO TAB ── */}
      {tab === 'video' && (
        <div className="rounded-2xl overflow-hidden" style={{ background: dark ? 'rgba(255,255,255,.04)' : '#fff', border: `0.5px solid ${t.cardBorder}` }}>
          {videoStatus?.enabled ? (
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${t.accent}, ${dark ? '#6b3a4a' : '#8b5e6b'})` }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  </div>
                  <div className="text-[13px] font-bold" style={{ color: t.text }}>Watch Videos</div>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg" style={{ background: dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)', color: t.textMuted }}>
                  {videoStatus.watchedToday}/{videoStatus.dailyCap} today
                </span>
              </div>
              <p className="text-[13px] leading-relaxed" style={{ color: t.textMuted }}>
                Watch short videos to earn ₦{((videoStatus.rewardPerWatch || 1500) / 100).toFixed(0)} per video.
                We split ad revenue 50/50 with you.
              </p>
              {videoStatus.remaining > 0 ? (
                <button className="shimmer-btn w-full py-3 rounded-xl text-sm font-semibold border-none cursor-pointer" style={{ background: `linear-gradient(135deg, ${t.accent}, #8b5e6b)`, color: '#fff', boxShadow: '0 4px 16px rgba(196,125,142,.3)' }}>
                  Watch Video → Earn ₦{((videoStatus.rewardPerWatch || 1500) / 100).toFixed(0)}
                </button>
              ) : (
                <div className="py-4 text-center text-[13px]" style={{ color: t.textMuted }}>
                  Daily limit reached. Come back tomorrow!
                </div>
              )}
            </div>
          ) : (
            <div className="py-16 flex flex-col items-center justify-center relative overflow-hidden">
              {/* Decorative blurs */}
              <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-15 blur-2xl" style={{ background: t.accent }} />
              <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full opacity-10 blur-2xl" style={{ background: t.accent }} />

              <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: `linear-gradient(135deg, ${t.accent}, ${dark ? '#6b3a4a' : '#8b5e6b'})`, boxShadow: '0 8px 24px rgba(196,125,142,.25)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </div>
              <div className="text-base font-bold mb-1" style={{ color: t.text }}>Watch & Earn</div>
              <div className="text-xs text-center max-w-[260px] leading-relaxed" style={{ color: t.textMuted }}>
                Video rewards launching soon. Watch short ads and earn wallet credit — we split the revenue 50/50 with you.
              </div>
              <div className="mt-4 px-3 py-1.5 rounded-lg text-[11px] font-semibold" style={{ background: dark ? 'rgba(196,125,142,.1)' : 'rgba(196,125,142,.08)', color: t.accent, border: `1px solid ${dark ? 'rgba(196,125,142,.2)' : 'rgba(196,125,142,.12)'}` }}>
                Coming Soon
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
