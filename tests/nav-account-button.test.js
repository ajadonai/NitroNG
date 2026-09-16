import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const dash = readFileSync(new URL('../components/dashboard.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

/**
 * The account button says whose account it is.
 *
 * It was a bare 34px circle whose CSS already carried `gap: 8px` — the slot for
 * a label had been there the whole time with nothing in it.
 */
describe('the nav account button', () => {
  const btn = dash.slice(dash.indexOf('className="dash-avatar-btn"'), dash.indexOf('{avOpen && ('));

  it('keeps the real avatar rather than drawing initials', () => {
    expect(btn).toMatch(/<Avatar size=\{26\} \/>/);
  });

  it('reads avatar, then name, then chevron', () => {
    // Tried name-first and it came back: the face leads.
    const iFace = btn.indexOf('<Avatar size={26} />');
    const iName = btn.indexOf('dash-av-name');
    const iChev = btn.indexOf('dash-av-chev');
    expect(iFace).toBeGreaterThan(-1);
    expect(iName).toBeGreaterThan(iFace);
    expect(iChev).toBeGreaterThan(iName);
  });

  it('shows the first name, not the full one', () => {
    // Full names run long — "Oluwaseun Adebayo-Williams" — and this sits right
    // of a balance pill and a bell, so a full name truncates on the customers
    // who have one and leaves the button a different width for everybody.
    expect(btn).toMatch(/\(user\?\.name \|\| ""\)\.trim\(\)\.split\(\/\\s\+\/\)\[0\]/);
  });

  it('carries a chevron, because it opens a menu', () => {
    // A face and a name with nothing after them read as a link to a profile.
    expect(btn).toMatch(/dash-av-chev/);
    expect(btn).toMatch(/aria-haspopup="menu"/);
  });

  it('never lets the flex row crush the name', () => {
    // A flex row shrinks its children before it overflows, and this button was
    // the one giving way — so "Jonathan" rendered as "Jo". That was not a long
    // name truncating, it was a short one being crushed.
    expect(css).toMatch(/\.dash-avatar-btn \{ flex-shrink: 0; \}/);
  });

  it('only shows the name where there is room for it', () => {
    // The nav's right cluster carries five controls — currency, language, the
    // balance pill, the bell and this. At 1200 with all of them up there is
    // nothing left over.
    //
    // Matched against the whole sheet rather than a window after the @media
    // line: these declarations are unique, and a fixed-length slice broke twice
    // just because the comments above them grew.
    expect(css).toMatch(/\.dash-av-name, \.dash-av-chev \{ display: none; \}/);
    expect(css).toMatch(/@media \(min-width: 1400px\)/);
    expect(css).toMatch(/\.dash-av-name \{ display: block;/);
    expect(css).toMatch(/\.dash-av-chev \{ display: block;/);
  });

  it('names its own ink, in both themes', () => {
    // It had none and inherited, and what it inherited from is not theme-aware,
    // so the name rendered black on the dark nav.
    expect(css).toMatch(/\.dash-av-name \{[^}]*color: var\(--t-text\)/s);
    expect(css).toMatch(/\.dash-av-chev \{[^}]*color: var\(--t-text-muted\)/s);
  });

  it('seats the avatar inside the border rather than filling the cap', () => {
    // At 2px the avatar was concentric with the 17px cap — a photo pressed into
    // a ring. Two earlier attempts went tighter and were wrong, but both kept
    // the face at 30px, which is what actually made a small inset read badly:
    // 30 in a 34px pill leaves 2px above and below, so the avatar looked shoved
    // sideways however much room was beside it.
    //
    // 6px is the geometry the rest of the cluster already uses — .loc-pill for
    // currency and language, pl-1.5 pr-3 on the balance pill — so the face now
    // starts on the same left edge as every icon beside it.
    //
    // The face itself was never the problem: <Avatar size={26}> sets its own
    // inline width, so it already cleared 4px top and bottom. Only the lead was
    // wrong. The .dash-avatar rule in the sheet styles nothing at all now —
    // pre-existing dead code, left alone rather than swept up here.
    expect(css).toMatch(/\.dash-avatar-btn \{ width: auto; padding-block: 0; padding-inline: 6px 12px;/);
    expect(css, 'the neighbours it is matching').toMatch(/\.loc-pill \{[^}]*padding-inline: 6px 12px/s);
    const dash = readFileSync(new URL('../components/dashboard.jsx', import.meta.url), 'utf8');
    expect(dash).toMatch(/dash-balance-pill[^"]*pl-1\.5 pr-3/);
    expect(dash).not.toMatch(/avatarPx/);
  });

  it('truncates rather than pushing the nav around', () => {
    expect(css).toMatch(/\.dash-av-name \{[^}]*max-width: 116px;/s);
    expect(css).toMatch(/\.dash-av-name \{[^}]*text-overflow: ellipsis/s);
  });

  it('still names the account in the menu, so nothing is lost by shortening', () => {
    expect(dash).toMatch(/\{user\?\.name \|\| tr\("Your account"\)\}/);
    expect(dash).toMatch(/\{user\?\.email \|\| ""\}/);
  });
});
