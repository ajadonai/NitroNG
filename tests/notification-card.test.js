import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const dash = readFileSync(new URL('../components/dashboard.jsx', import.meta.url), 'utf8');

/**
 * One card, one of each fact.
 *
 * A cancelled order said so three times: the title read "Order cancelled", the
 * icon beside it was a red ✗, and the description appended "— cancelled" to the
 * service name — on the line whose whole job is to say WHICH order it was. The
 * date was printed twice as well, verbatim, because the sticky day header was
 * built with the same formatter as the row beneath it.
 */
describe('the notification card', () => {
  it('names the service, and lets the title carry the status', () => {
    expect(dash).toMatch(/desc: o\.service \|\| tr\("Service"\),/);
    expect(dash).not.toMatch(/\$\{o\.service \|\| tr\("Service"\)\} — \$\{s === "Completed"/);
  });

  it('keeps the status on the title and the icon, where it belongs', () => {
    // Removing it from the description must not remove it from the card.
    expect(dash).toMatch(/title: s === "Completed" \? tr\("Order delivered"\)/);
    expect(dash).toMatch(/icon: s === "Completed" \? "check" : s === "Cancelled" \? "x"/);
  });

  it('makes the day header a day', () => {
    // fD without dateOnly returns the time and the zone too, so the header read
    // "9 SEPT, 02:06 WAT" directly above a row reading "9 Sept, 02:06 WAT".
    expect(dash).toMatch(/: fD\(n\.ts, true\)/);
  });

  it('makes the row a time, since the header already gave the day', () => {
    expect(dash).toMatch(/time: o\.created \? fT\(o\.created\)/);
    expect(dash).not.toMatch(/time: o\.created \? fD\(o\.created\)/);
    expect(dash).not.toMatch(/time: tx\.date \? fD\(tx\.date\)/);
    expect(dash).toMatch(/import \{ fD, fT \} from "\.\.\/lib\/format"/);
  });

  it('keeps the order number, which is what a customer pastes into WhatsApp', () => {
    // Support is WhatsApp, so NTR-9784 is the one string that has to leave this
    // screen with them. "View order" is a different job — it goes somewhere.
    expect(dash).toMatch(/\{n\.ref\}<\/span>/);
  });
});
