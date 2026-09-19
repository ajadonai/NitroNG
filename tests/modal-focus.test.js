import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * A dialog must not take focus back while somebody is typing in it.
 *
 * Modal's focus effect depended on `onClose`, and all 34 callers pass an inline
 * arrow — `onClose={() => setCancelPrompt(null)}` — which is a new identity on
 * every render of the parent. So any parent re-render tore the effect down and
 * set it up again: the cleanup returned focus to whatever opened the dialog and
 * the setup moved it to the panel. The field's state lives in the parent, so
 * that was every keystroke. Typing a cancellation reason lost focus one letter
 * in; the menu builder did the same, for the same reason.
 */
const src = fs.readFileSync(path.join(process.cwd(), 'components/ui-primitives.jsx'), 'utf8');

describe('Modal keeps focus where the typing is', () => {
  const effect = src.slice(src.indexOf('restoreRef.current = document.activeElement'));
  const deps = effect.slice(0, effect.indexOf('\n\n')).match(/\}, \[([^\]]*)\]\)/)?.[1] ?? '';

  it('does not re-run its focus effect when onClose changes identity', () => {
    expect(deps).not.toMatch(/onClose/);
    expect(deps.replace(/\s/g, '')).toBe('open');
  });

  it('still closes on Escape, through a ref rather than a dependency', () => {
    expect(src).toContain('closeRef.current = onClose');
    expect(src).toMatch(/Escape.*closeRef\.current\?\.\(\)/);
  });

  it('callers are still free to pass an inline arrow', () => {
    // This is the shape that broke it, and it has to stay safe — rewriting 34
    // call sites to useCallback would have been the fragile fix.
    const callers = fs.readdirSync(path.join(process.cwd(), 'components'))
      .filter(f => f.endsWith('.jsx'))
      .filter(f => /onClose=\{\(\) =>/.test(fs.readFileSync(path.join(process.cwd(), 'components', f), 'utf8')));
    expect(callers.length).toBeGreaterThan(10);
  });
});
