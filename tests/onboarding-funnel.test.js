import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * The funnel step that measured nothing.
 *
 * `firstSeenNewOrderAt` was stamped when the Services tab became active, and
 * the dashboard opens on the Services tab — `useState("services")`. So it fired
 * on first render for every account that ever loaded the page, and the funnel
 * read 99.0% of 2,082 signups "reaching New Order".
 *
 * That was the redirect, not the product. The 1.0% without the stamp had no
 * wallet stamp either, which is a beacon that never ran rather than a person
 * who never looked — so the true figure is 100% and the step carried no
 * information at all. Trip caught it: "99% reach the new order cos its
 * automatically the first page everybody lands on."
 *
 * It now waits for a service to be picked, which is a deliberate act, so the
 * funnel can finally separate somebody who considered an order from somebody
 * who landed and left.
 */
const dash = readFileSync(new URL('../components/dashboard.jsx', import.meta.url), 'utf8');

describe('the new order funnel signal', () => {
  it('waits for a service to be picked, not for the tab to render', () => {
    expect(dash).toMatch(/\(active === "services" && noSelSvc\) \? "new_order"/);
    expect(dash, 'must not stamp on the tab alone').not.toMatch(/active === "services" \? "new_order"/);
  });

  it('re-runs when the selection changes, or it can never fire', () => {
    expect(dash).toMatch(/\}, \[active, noSelSvc\]\);/);
  });

  it('is declared after the lifted selection it reads', () => {
    // A const read in a dependency array is evaluated during render, so an
    // effect placed above `noSelSvc` would throw on every dashboard load.
    expect(dash.indexOf('const [noSelSvc, setNoSelSvc]')).toBeLessThan(dash.indexOf('[active, noSelSvc]'));
  });

  it('still stamps the wallet on arrival, which is already a deliberate visit', () => {
    // Nobody lands on the wallet by default; going there is the act.
    expect(dash).toMatch(/active === "add-funds" \? "wallet"/);
  });

  it('records why the old signal was wrong, where the next reader will look', () => {
    expect(dash).toMatch(/measured "logged in"/);
  });
});
