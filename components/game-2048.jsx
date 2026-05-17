'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { initGame, move, canMove, hasWon, spawnTile } from '@/lib/game-engine';

const TILE_COLORS = {
  0: { bg: 'transparent', text: 'transparent', border: 'transparent' },
  2: { bg: '#fdf2f4', text: '#8a6070', border: '#f0dce2' },
  4: { bg: '#f8e2e8', text: '#8a6070', border: '#ecc8d2' },
  8: { bg: '#e8a8b8', text: '#fff', border: '#d8909a' },
  16: { bg: '#d98a9a', text: '#fff', border: '#c47d8e' },
  32: { bg: '#c47d8e', text: '#fff', border: '#a3586b' },
  64: { bg: '#a3586b', text: '#fff', border: '#8a4558' },
  128: { bg: '#8a4558', text: '#fff', border: '#703548' },
  256: { bg: '#703548', text: '#fff', border: '#5c2838' },
  512: { bg: '#5c2838', text: '#fff', border: '#481c2c' },
  1024: { bg: '#481c2c', text: '#fff', border: '#351220' },
  2048: { bg: '#2c0a14', text: '#f0c0d0', border: '#1a0008' },
};

const DARK_TILE_COLORS = {
  0: { bg: 'transparent', text: 'transparent', border: 'transparent' },
  2: { bg: 'rgba(196,125,142,.08)', text: 'rgba(255,255,255,.6)', border: 'rgba(196,125,142,.15)' },
  4: { bg: 'rgba(196,125,142,.14)', text: 'rgba(255,255,255,.7)', border: 'rgba(196,125,142,.22)' },
  8: { bg: 'rgba(196,125,142,.22)', text: '#e8a8b8', border: 'rgba(196,125,142,.32)' },
  16: { bg: 'rgba(196,125,142,.30)', text: '#d98a9a', border: 'rgba(196,125,142,.40)' },
  32: { bg: 'rgba(196,125,142,.38)', text: '#c47d8e', border: 'rgba(196,125,142,.48)' },
  64: { bg: 'rgba(163,88,107,.45)', text: '#c47d8e', border: 'rgba(163,88,107,.55)' },
  128: { bg: 'rgba(138,69,88,.50)', text: '#d98a9a', border: 'rgba(138,69,88,.60)' },
  256: { bg: 'rgba(112,53,72,.55)', text: '#e8a8b8', border: 'rgba(112,53,72,.65)' },
  512: { bg: 'rgba(92,40,56,.60)', text: '#f0c0d0', border: 'rgba(92,40,56,.70)' },
  1024: { bg: 'rgba(72,28,44,.65)', text: '#f0c0d0', border: 'rgba(72,28,44,.75)' },
  2048: { bg: 'rgba(44,10,20,.75)', text: '#f0c0d0', border: 'rgba(44,10,20,.85)' },
};

function getTileStyle(value, dark) {
  const palette = dark ? DARK_TILE_COLORS : TILE_COLORS;
  return palette[value] || palette[2048];
}

export default function Game2048({ dark, t, onScoreSubmitted }) {
  const [board, setBoard] = useState(null);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [moveLog, setMoveLog] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const rngRef = useRef(null);
  const touchRef = useRef(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('nitro-2048-best');
      if (saved) setBestScore(parseInt(saved));
    } catch {}
  }, []);

  const startNewGame = useCallback(async () => {
    setLoading(true);
    setGameOver(false);
    setWon(false);
    setScore(0);
    setMoveLog('');
    setSubmitted(false);
    try {
      const res = await fetch('/api/earn/game/start', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSessionId(data.sessionId);
      const { board: b, rng } = initGame(data.seed);
      rngRef.current = rng;
      setBoard(b);
      setStartTime(Date.now());
    } catch (err) {
      console.error('Failed to start game:', err);
    }
    setLoading(false);
  }, []);

  const submitScore = useCallback(async (finalScore, moves) => {
    if (submitting || submitted || !sessionId) return;
    setSubmitting(true);
    const duration = Math.round((Date.now() - startTime) / 1000);
    try {
      const res = await fetch('/api/earn/game/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, score: finalScore, moves, duration }),
      });
      const data = await res.json();
      if (res.ok && data.verified) {
        setSubmitted(true);
        if (finalScore > bestScore) {
          setBestScore(finalScore);
          try { localStorage.setItem('nitro-2048-best', String(finalScore)); } catch {}
        }
        onScoreSubmitted?.();
      }
    } catch (err) {
      console.error('Submit failed:', err);
    }
    setSubmitting(false);
  }, [submitting, submitted, sessionId, startTime, bestScore, onScoreSubmitted]);

  const handleMove = useCallback((direction) => {
    if (!board || gameOver || won) return;
    const result = move(board, direction);
    if (!result.moved) return;
    const newBoard = result.board;
    const newScore = score + result.score;
    const newMoveLog = moveLog + direction;
    spawnTile(newBoard, rngRef.current);
    setBoard([...newBoard]);
    setScore(newScore);
    setMoveLog(newMoveLog);

    if (hasWon(newBoard)) {
      setWon(true);
      submitScore(newScore, newMoveLog);
    } else if (!canMove(newBoard)) {
      setGameOver(true);
      submitScore(newScore, newMoveLog);
    }
  }, [board, score, moveLog, gameOver, won, submitScore]);

  useEffect(() => {
    const handler = (e) => {
      if (showHelp) return;
      const map = { ArrowUp: 'U', ArrowDown: 'D', ArrowLeft: 'L', ArrowRight: 'R' };
      if (map[e.key]) { e.preventDefault(); handleMove(map[e.key]); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleMove, showHelp]);

  const onTouchStart = (e) => { touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e) => {
    if (!touchRef.current) return;
    const dx = e.changedTouches[0].clientX - touchRef.current.x;
    const dy = e.changedTouches[0].clientY - touchRef.current.y;
    if (Math.abs(dx) < 30 && Math.abs(dy) < 30) return;
    handleMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U'));
    touchRef.current = null;
  };

  const moveCount = moveLog.length;
  const cellBg = dark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)';

  return (
    <div className="flex flex-col items-center w-full">
      {/* Score bar */}
      <div className="flex items-stretch gap-2 w-full max-w-[340px] mb-3">
        <div className="flex-1 py-2 px-3 rounded-xl" style={{ background: dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.025)', border: `1px solid ${dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.05)'}` }}>
          <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: t.textMuted }}>Score</div>
          <div className="text-xl font-bold tabular-nums" style={{ color: t.text }}>{score.toLocaleString()}</div>
        </div>
        <div className="flex-1 py-2 px-3 rounded-xl" style={{ background: dark ? 'rgba(196,125,142,.08)' : 'rgba(196,125,142,.05)', border: `1px solid ${dark ? 'rgba(196,125,142,.18)' : 'rgba(196,125,142,.1)'}` }}>
          <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: t.accent }}>Best</div>
          <div className="text-xl font-bold tabular-nums" style={{ color: t.accent }}>{bestScore.toLocaleString()}</div>
        </div>
        <div className="flex flex-col gap-1.5 justify-center">
          <button onClick={() => setShowHelp(true)} className="w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer" style={{ background: dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.03)', border: `1px solid ${dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.05)'}`, color: t.textMuted }} title="How to play">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </button>
          {board && !gameOver && !won && (
            <button onClick={startNewGame} className="w-8 h-8 rounded-lg flex items-center justify-center border-none cursor-pointer" style={{ background: dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.03)', border: `1px solid ${dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.05)'}`, color: t.textMuted }} title="Restart">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* Grid wrapper with glow */}
      <div className="relative w-full max-w-[340px]">

        <div
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          className="relative rounded-2xl p-2.5 w-full aspect-square select-none"
          style={{
            background: dark ? 'rgba(255,255,255,.05)' : 'rgba(196,125,142,.04)',
            border: `1.5px solid ${dark ? 'rgba(196,125,142,.15)' : 'rgba(196,125,142,.12)'}`,
            boxShadow: dark ? '0 8px 32px rgba(0,0,0,.3)' : '0 8px 32px rgba(196,125,142,.1)',
            touchAction: 'none',
          }}
        >
          <div className="grid grid-cols-4 grid-rows-4 gap-[6px] w-full h-full">
            {(board || Array.from({ length: 4 }, () => [0, 0, 0, 0])).flat().map((val, i) => {
              const style = getTileStyle(val, dark);
              return (
                <div
                  key={i}
                  className="rounded-[10px] flex items-center justify-center font-bold aspect-square"
                  style={{
                    background: val === 0 ? cellBg : style.bg,
                    border: `1.5px solid ${val === 0 ? (dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.04)') : style.border}`,
                    color: style.text,
                    fontSize: val >= 1024 ? '14px' : val >= 128 ? '18px' : '22px',
                    fontFamily: 'var(--font-body)',
                    boxShadow: val >= 32 ? (dark ? '0 2px 8px rgba(0,0,0,.3)' : '0 2px 8px rgba(196,125,142,.15)') : 'none',
                    transition: 'background .1s, border-color .1s',
                  }}
                >
                  {val || ''}
                </div>
              );
            })}
          </div>

          {/* Game over */}
          {(gameOver || won) && (
            <div className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center backdrop-blur-sm" style={{ background: dark ? 'rgba(0,0,0,.7)' : 'rgba(255,255,255,.75)' }}>
              <div className="text-3xl mb-2">{won ? '🎉' : '💔'}</div>
              <div className="text-xl font-bold mb-0.5" style={{ color: won ? t.accent : t.text }}>{won ? 'You reached 2048!' : 'Game Over'}</div>
              <div className="text-lg font-bold tabular-nums" style={{ color: t.text }}>{score.toLocaleString()} pts</div>
              <div className="text-[11px] mb-5 mt-0.5" style={{ color: t.textMuted }}>
                {submitting ? 'Saving score...' : submitted ? 'Saved to leaderboard!' : `${moveCount} moves`}
              </div>
              <button onClick={startNewGame} className="shimmer-btn px-7 py-2.5 rounded-xl text-sm font-semibold border-none cursor-pointer" style={{ background: `linear-gradient(135deg, ${t.accent}, #8b5e6b)`, color: '#fff', boxShadow: '0 4px 16px rgba(196,125,142,.3)' }}>
                Play Again
              </button>
            </div>
          )}

          {/* Start screen */}
          {!board && !loading && (
            <div className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center" style={{ background: dark ? 'rgba(0,0,0,.6)' : 'rgba(255,255,255,.6)' }}>
              <div className="text-4xl font-bold mb-1" style={{ color: t.accent, textShadow: '0 2px 12px rgba(196,125,142,.3)' }}>2048</div>
              <div className="text-xs mb-4" style={{ color: t.textMuted }}>Merge tiles. Climb the leaderboard.</div>
              <button onClick={startNewGame} className="shimmer-btn px-7 py-3 rounded-xl text-sm font-semibold border-none cursor-pointer" style={{ background: `linear-gradient(135deg, ${t.accent}, #8b5e6b)`, color: '#fff', boxShadow: '0 4px 16px rgba(196,125,142,.3)' }}>
                Start Game
              </button>
            </div>
          )}

          {loading && (
            <div className="absolute inset-0 rounded-2xl flex items-center justify-center" style={{ background: dark ? 'rgba(0,0,0,.5)' : 'rgba(255,255,255,.5)' }}>
              <div className="text-sm font-medium" style={{ color: t.textMuted }}>Starting...</div>
            </div>
          )}
        </div>
      </div>

      {/* Move counter */}
      {board && !gameOver && !won && (
        <div className="mt-2 text-[11px] font-medium tabular-nums" style={{ color: t.textMuted }}>{moveCount} moves</div>
      )}

      {/* How to play modal */}
      {showHelp && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={(e) => { if (e.target === e.currentTarget) setShowHelp(false); }}>
          <div className="relative overflow-hidden" style={{ background: dark ? '#1a1f32' : '#fff', borderRadius: 20, padding: '28px 24px', maxWidth: 380, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,.35)' }}>
            {/* Decorative accent glow */}
            <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full opacity-15 blur-2xl" style={{ background: t.accent }} />

            <div className="relative flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${t.accent}, ${dark ? '#6b3a4a' : '#8b5e6b'})` }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff" stroke="none"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                </div>
                <h3 className="text-[15px] font-bold" style={{ color: t.text }}>How to Play</h3>
              </div>
              <button onClick={() => setShowHelp(false)} className="w-7 h-7 rounded-lg flex items-center justify-center border-none cursor-pointer" style={{ background: dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.05)', color: t.textMuted }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="relative space-y-3">
              {[
                ['Swipe or use arrow keys to slide all tiles.', '↔'],
                ['Same numbers collide and merge into one.', '⊕'],
                ['A new tile appears after every move.', '✦'],
                ['Reach 2048 to win. Score = total merges.', '🏆'],
              ].map(([text, icon], i) => (
                <div key={i} className="flex gap-3 items-center py-2 px-3 rounded-xl" style={{ background: dark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.02)' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm" style={{ background: dark ? 'rgba(196,125,142,.12)' : 'rgba(196,125,142,.08)', color: t.accent }}>{icon}</div>
                  <p className="text-[13px] leading-[1.45]" style={{ color: dark ? 'rgba(255,255,255,.7)' : 'rgba(0,0,0,.6)' }}>{text}</p>
                </div>
              ))}
            </div>
            <div className="relative mt-4 p-3 rounded-xl" style={{ background: dark ? 'rgba(196,125,142,.08)' : 'rgba(196,125,142,.05)', border: `1px solid ${dark ? 'rgba(196,125,142,.15)' : 'rgba(196,125,142,.08)'}` }}>
              <div className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: t.accent }}>Win Real Money</div>
              <p className="text-[12px] leading-[1.55]" style={{ color: t.textMuted }}>
                Your best score each month enters the leaderboard. Top 5 players win wallet credit. Play unlimited times — only your highest counts.
              </p>
            </div>
            <button onClick={() => setShowHelp(false)} className="relative w-full mt-4 py-2.5 rounded-xl text-sm font-semibold border-none cursor-pointer" style={{ background: `linear-gradient(135deg, ${t.accent}, #8b5e6b)`, color: '#fff' }}>
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
