import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('authentication form semantics', () => {
  it('uses a submit-capable form and connected fields in the customer modal', () => {
    const modal = source('components/auth-modal.jsx');

    expect(modal).toContain('<form onSubmit={handleAuthSubmit} noValidate>');
    expect(modal).toContain('htmlFor="login-password"');
    expect(modal).toContain('id="login-password"');
    expect(modal).toContain('autoComplete="current-password"');
    expect(modal).toContain('type="submit"');
    expect(modal).not.toContain("onKeyDown={(e) => e.key === 'Enter' && handleLogin()}");
    expect(modal).toContain('remember,');
  });

  it('uses a submit-capable form, connected labels, and a controlled Remember me option in the homepage card', () => {
    // landing-v3.jsx, because that is the page a customer reaches:
    // app/page.jsx → home-client.jsx → landing-v3.jsx. This read
    // components/landing-page.jsx until 14 Sep 2026, a file no route had
    // imported for weeks, so every guarantee below was being checked against
    // markup nobody could see. Deleted with that discovery.
    const landing = source('components/landing-v3.jsx');

    expect(landing).toContain('<form onSubmit={handleHeroAuthSubmit} noValidate');
    for (const id of [
      'hero-login-email',
      'hero-login-password',
      'hero-signup-first',
      'hero-signup-last',
      'hero-signup-email',
      'hero-signup-phone',
      'hero-signup-password',
      'hero-signup-confirm',
      'hero-forgot-email',
    ]) {
      expect(landing).toContain(`htmlFor="${id}"`);
      expect(landing).toContain(`id="${id}"`);
    }
    expect(landing).toContain('checked={heroRemember}');
    expect(landing).toContain('remember:heroRemember');
    expect(landing).not.toContain('onKeyDown={e=>{if(e.key==="Enter")heroLoginSubmit()}');
  });

  it('uses a semantic admin form and sends the controlled persistence choice', () => {
    const admin = source('components/admin-login.jsx');

    expect(admin).toContain('<form onSubmit=');
    expect(admin).toContain('htmlFor="admin-login-email"');
    expect(admin).toContain('id="admin-login-email"');
    expect(admin).toContain('htmlFor="admin-login-password"');
    expect(admin).toContain('id="admin-login-password"');
    expect(admin).toContain('checked={remember}');
    expect(admin).toContain('JSON.stringify({email,password:pw,remember})');
    expect(admin).not.toContain('onKeyDown={e=>{if(e.key==="Enter")handleLogin()}');
  });

  it('announces dynamic authentication errors and success messages', () => {
    const alerts = source('components/inline-alert.jsx');
    const modal = source('components/auth-modal.jsx');

    expect(alerts).toContain('role={type === "error" ? "alert" : "status"}');
    expect(alerts).toContain('aria-live={type === "error" ? "assertive" : "polite"}');
    expect(modal).toContain('role="alert"');
    expect(modal).toContain('role="status"');
  });
});
