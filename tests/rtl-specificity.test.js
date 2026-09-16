import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Three bugs, one cause: a media query cannot outrank a [dir] rule.
 *
 * The RTL plugin rewrites asymmetric physical CSS into `[dir="ltr"] .sel`,
 * which is (0,2,0). A media query adds no specificity, so `.sel` inside one is
 * (0,1,0) and loses at every width — silently, with both rules in the sheet.
 *
 * These pin the three fixes rather than trying to detect the pattern in
 * general: two of the three were Tailwind utilities, not anything in
 * globals.css, so no scan of our own stylesheet would have found them. The
 * reasoning is written up in CLAUDE.md.
 */
const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const landing = readFileSync(new URL('../components/landing-v3.jsx', import.meta.url), 'utf8');

describe('the three places this has bitten', () => {
  it('keeps the locale pills on a logical property', () => {
    // padding-inline generates no [dir] rule, so the mobile override applies.
    expect(css).toMatch(/\.loc-pill \{[^}]*padding-inline: 6px 12px/s);
    expect(css).not.toMatch(/\.loc-pill \{[^}]*padding: 0 12px 0 6px/s);
  });

  it('keeps the hero column on text-start, not text-left', () => {
    // text-align: start is already logical. text-left became
    // [dir="ltr"] .text-left and beat max-desktop:text-center at every width,
    // so the centring had never once applied.
    expect(landing).toMatch(/className="text-start relative z-\[1\] max-desktop:text-center/);
    expect(landing).not.toMatch(/className="text-left relative z-\[1\]/);
  });

  it('keeps Arabic nav links out of the absolute centring', () => {
    // The plugin flips the inset and not the translate, so the pair compounds
    // instead of cancelling and the links land on top of the controls.
    expect(css).toMatch(/\[dir="rtl"\] \.nav-centre \{ position: static; translate: none; \}/);
  });

  it('flips a transform-origin by hand, since the plugin will not', () => {
    expect(css).toMatch(/\[dir="rtl"\] \.nav-link-pill::after \{ transform-origin: right; \}/);
  });

  it('is written down where the next person will look', () => {
    const md = readFileSync(new URL('../CLAUDE.md', import.meta.url), 'utf8');
    expect(md).toMatch(/## The `\[dir="ltr"\]` specificity trap/);
    expect(md).toMatch(/A media query adds no specificity of its own/);
    expect(md).toMatch(/no scan of our own stylesheet would have caught them/);
  });
});
