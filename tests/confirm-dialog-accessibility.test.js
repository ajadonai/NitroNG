import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  getDialogFocusableElements,
  restoreDialogTrigger,
  trapDialogFocus,
} from '@/components/confirm-dialog';

function focusable(overrides = {}) {
  return {
    disabled: false,
    hidden: false,
    isConnected: true,
    tabIndex: 0,
    focus: vi.fn(),
    getAttribute: vi.fn(() => null),
    ...overrides,
  };
}

function keyEvent({ shiftKey = false } = {}) {
  return {
    key: 'Tab',
    shiftKey,
    preventDefault: vi.fn(),
  };
}

describe('shared confirmation dialog focus management', () => {
  it('keeps only interactive, visible and enabled elements in the tab order', () => {
    const enabled = focusable();
    const disabled = focusable({ disabled: true });
    const hidden = focusable({ hidden: true });
    const ariaHidden = focusable({ getAttribute: vi.fn(name => name === 'aria-hidden' ? 'true' : null) });
    const removedFromTabOrder = focusable({ tabIndex: -1 });
    const container = {
      querySelectorAll: vi.fn(() => [enabled, disabled, hidden, ariaHidden, removedFromTabOrder]),
    };

    expect(getDialogFocusableElements(container)).toEqual([enabled]);
  });

  it('wraps Tab from the last control back to the first', () => {
    const first = focusable();
    const last = focusable();
    const container = {
      contains: element => element === first || element === last,
      querySelectorAll: () => [first, last],
    };
    const event = keyEvent();

    expect(trapDialogFocus(event, container, last)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(first.focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('wraps Shift+Tab from the first control back to the last', () => {
    const first = focusable();
    const last = focusable();
    const container = {
      contains: element => element === first || element === last,
      querySelectorAll: () => [first, last],
    };
    const event = keyEvent({ shiftKey: true });

    expect(trapDialogFocus(event, container, first)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(last.focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('moves escaped focus back inside and falls back to the dialog itself', () => {
    const first = focusable();
    const containerWithControl = {
      contains: () => false,
      querySelectorAll: () => [first],
    };
    const escapedEvent = keyEvent();

    expect(trapDialogFocus(escapedEvent, containerWithControl, focusable())).toBe(true);
    expect(first.focus).toHaveBeenCalledWith({ preventScroll: true });

    const emptyDialog = {
      focus: vi.fn(),
      querySelectorAll: () => [],
    };
    const emptyEvent = keyEvent();

    expect(trapDialogFocus(emptyEvent, emptyDialog, null)).toBe(true);
    expect(emptyDialog.focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('restores focus only to a trigger that is still connected', () => {
    const trigger = focusable();
    const removedTrigger = focusable({ isConnected: false });

    expect(restoreDialogTrigger(trigger)).toBe(true);
    expect(trigger.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(restoreDialogTrigger(removedTrigger)).toBe(false);
    expect(removedTrigger.focus).not.toHaveBeenCalled();
  });
});

describe('shared confirmation dialog accessibility wiring', () => {
  const source = readFileSync('components/confirm-dialog.jsx', 'utf8');

  it('names modal confirmations and gives destructive prompts alert semantics', () => {
    expect(source).toContain('role={dialog.danger ? "alertdialog" : "dialog"}');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain('aria-labelledby={titleId}');
    expect(source).toContain('aria-describedby={descriptionId}');
    expect(source).toContain('<h2 id={titleId}');
    expect(source).toContain('<div id={descriptionId}>');
  });

  it('starts on the safe action, supports Escape and restores the invoking control', () => {
    expect(source).toContain('triggerRef.current = globalThis.document?.activeElement || null');
    expect(source).toContain('cancelButtonRef.current?.focus({ preventScroll: true })');
    expect(source).toContain('if (event.key === "Escape")');
    expect(source).toContain('trapDialogFocus(event, dialogRef.current)');
    expect(source).toContain('restoreDialogTrigger(triggerRef.current)');
  });

  it('labels typed confirmation input and prevents dialog buttons submitting a parent form', () => {
    expect(source).toContain('<label htmlFor={confirmationInputId}');
    expect(source).toContain('id={confirmationInputId}');
    expect(source.match(/type="button"/g)).toHaveLength(2);
  });
});
