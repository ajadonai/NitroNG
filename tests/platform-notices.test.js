import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../components/new-order.jsx', import.meta.url), 'utf8');
const dicts = Object.fromEntries(['pcm', 'fr', 'sw', 'ar'].map(l =>
  [l, JSON.parse(readFileSync(new URL(`../messages/${l}.json`, import.meta.url), 'utf8'))]
));

// The TikTok and YouTube pop-ups are the last thing between a user and the
// order form, so what they say decides whether the order happens. Both were
// written as disclaimers — the TikTok one opened by apologising, closed on a
// consent sentence, and offered two buttons for a decision nobody had to make.
// These assertions pin the rewrite: advice instead of a hedge, a reason
// instead of a rule, and one button.

const tiktok = src.slice(src.indexOf('TIKTOK DISCLAIMER'), src.indexOf('YOUTUBE DISCLAIMER'));
const youtube = src.slice(src.indexOf('YOUTUBE DISCLAIMER'), src.indexOf('WEBSITE TRAFFIC GATE'));

describe('the TikTok notice', () => {
  it('leads with the instruction, not the apology', () => {
    expect(tiktok).toContain('tr("Start small on TikTok")');
    expect(src).not.toContain("TikTok is the one platform we can't promise on");
  });

  it('says a short order is refunded, which the warning never did', () => {
    expect(tiktok).toContain('You are refunded the part that never came.');
  });

  it('drops the consent line — tapping the button already means that', () => {
    expect(src).not.toContain("Placing a TikTok order means you're okay with this.");
  });

  it('keeps all three risks', () => {
    for (const risk of ['*slower*', '*stop short*', '*drop*']) expect(tiktok).toContain(risk);
  });
});

describe('the YouTube notice', () => {
  it('gives the reason, not the rule', () => {
    expect(youtube).toContain('tr("These arrive slowly, and that is the point")');
    expect(youtube).toContain('YouTube removes subscribers that show up all at once.');
    expect(src).not.toContain('YouTube watches for sudden jumps');
  });

  it('keeps the real drip rate — 50 – 500 a day, not a single made-up number', () => {
    expect(youtube).toContain('*50 – 500 a day*');
  });

  it('gives the good news ticks rather than small print', () => {
    expect(youtube).toContain('Nothing for you to do. Watch the count climb in *Orders*.');
    expect(youtube).toContain('✓');
    expect(src).not.toContain('Nothing to do on your side.');
  });
});

describe('both notices', () => {
  it('carry one button, saying the same word', () => {
    for (const [name, block] of [['tiktok', tiktok], ['youtube', youtube]]) {
      expect(block.match(/<button/g), name).toHaveLength(1);
      expect(block, name).toContain('tr("Got it")');
    }
    expect(src).not.toContain('tr("I understand")');
  });

  it('are translated into all four languages', () => {
    const strings = [...src.matchAll(/tr\("([^"]{12,})"\)/g)].map(m => m[1])
      .filter(s => tiktok.includes(s) || youtube.includes(s));
    expect(strings.length).toBeGreaterThan(8);
    for (const [lang, d] of Object.entries(dicts)) {
      for (const s of strings) expect(d[s], `${lang}: ${s.slice(0, 40)}`).toBeTruthy();
    }
  });

  it('keep the emphasis markers paired in every translation', () => {
    // <Emph> splits on "*" and bolds the odd segments, so a translation that
    // drops or adds a marker bolds the wrong half of the sentence.
    for (const en of Object.keys(dicts.pcm).filter(k => k.includes('*'))) {
      const want = (en.match(/\*/g) || []).length;
      for (const [lang, d] of Object.entries(dicts)) {
        expect((d[en].match(/\*/g) || []).length, `${lang}: ${en.slice(0, 40)}`).toBe(want);
      }
    }
  });
});
