import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  redactSensitiveText,
  sanitizeMonitoringValue,
  scrubSentryBreadcrumb,
  scrubSentryEvent,
} from '@/lib/monitoring-redaction';
import {
  createOperationalReporter,
  forwardServerRequestError,
  isExpectedRequestControlFlow,
} from '@/lib/monitoring';

function sentryScope() {
  return {
    setLevel: vi.fn(),
    setTag: vi.fn(),
    setFingerprint: vi.fn(),
    setContext: vi.fn(),
    captureException: vi.fn(),
    captureMessage: vi.fn(),
  };
}

describe('monitoring redaction', () => {
  it('removes credentials, PII, network addresses, and payment references from text', () => {
    const raw = [
      'Bearer top.secret.token',
      'email=customer@example.test',
      'password=hunter2',
      'from 197.210.1.4',
      'reference=NTR-PAY-12345',
      'phone +234 801 234 5678',
      'database postgresql://operator:db-password@production.example/nitro',
      'received NGN 50,000',
    ].join(' ');
    const clean = redactSensitiveText(raw);

    for (const sensitive of [
      'top.secret.token',
      'customer@example.test',
      'hunter2',
      '197.210.1.4',
      'NTR-PAY-12345',
      '234 801 234 5678',
      'db-password',
      'NGN 50,000',
    ]) {
      expect(clean).not.toContain(sensitive);
    }
  });

  it('redacts sensitive object keys without discarding safe operational counts', () => {
    expect(sanitizeMonitoringValue({
      provider: 'flutterwave',
      retryable: 3,
      customerEmail: 'person@example.test',
      balance: 50_000,
      nested: { authorization: 'Bearer secret' },
    })).toEqual({
      provider: 'flutterwave',
      retryable: 3,
      customerEmail: '[redacted]',
      balance: '[redacted]',
      nested: { authorization: '[redacted]' },
    });
  });

  it('strips user and request metadata from server Sentry events', () => {
    const event = scrubSentryEvent({
      message: 'Failed for person@example.test',
      user: { id: 'user-1', email: 'person@example.test' },
      request: {
        method: 'POST',
        url: 'https://nitro.ng/api/payments?token=secret',
        headers: { authorization: 'Bearer secret', cookie: 'session=secret' },
        data: { amount: 50_000 },
      },
    });

    expect(event.user).toBeUndefined();
    expect(event.request).toEqual({ method: 'POST', url: '/api/payments' });
    expect(event.message).not.toContain('person@example.test');
    expect(JSON.stringify(event)).not.toContain('secret');
  });

  it('masks dynamic access keys and invitation tokens in request paths', () => {
    const bulk = scrubSentryEvent({
      request: { method: 'GET', url: 'https://nitro.ng/api/orders/bulk/status/private-key' },
    });
    const invite = scrubSentryEvent({
      request: { method: 'GET', url: 'https://nitro.ng/pit/join/private-invite' },
    });
    expect(bulk.request.url).toBe('/api/orders/bulk/status/[redacted]');
    expect(invite.request.url).toBe('/pit/join/[redacted]');
  });

  it('strips reset tokens and fragments from browser navigation breadcrumbs', () => {
    const breadcrumb = scrubSentryBreadcrumb({
      category: 'navigation',
      data: {
        from: 'https://nitro.ng/?reset=RAW_RESET_TOKEN#form',
        to: '/dashboard?session=RAW_SESSION_TOKEN#balance',
      },
    });

    expect(breadcrumb.data).toEqual({ from: '/', to: '/dashboard' });
    expect(JSON.stringify(breadcrumb)).not.toContain('RAW_RESET_TOKEN');
    expect(JSON.stringify(breadcrumb)).not.toContain('RAW_SESSION_TOKEN');
  });
});

describe('server request error forwarding', () => {
  it('uses the Sentry request hook with a path-only request and sanitized error', () => {
    const sentry = { captureRequestError: vi.fn() };
    const error = new Error('Lookup failed for person@example.test token=raw-secret');

    expect(forwardServerRequestError(
      error,
      {
        path: '/api/orders?email=person@example.test',
        method: 'POST',
        headers: { authorization: 'Bearer raw-secret' },
      },
      { routerKind: 'App Router', routePath: '/api/orders', routeType: 'route' },
      { sentry },
    )).toBe(true);

    const [safeError, safeRequest, safeContext] = sentry.captureRequestError.mock.calls[0];
    expect(safeError.message).not.toContain('person@example.test');
    expect(safeError.message).not.toContain('raw-secret');
    expect(safeRequest).toEqual({ path: '/api/orders', method: 'POST', headers: {} });
    expect(safeContext).toEqual({
      routerKind: 'App Router',
      routePath: '/api/orders',
      routeType: 'route',
    });
  });

  it('filters framework redirects and not-found control flow', () => {
    for (const digest of [
      'NEXT_REDIRECT;replace;/login;307;',
      'NEXT_NOT_FOUND',
      'NEXT_HTTP_ERROR_FALLBACK;401',
      'NEXT_HTTP_ERROR_FALLBACK;403',
      'NEXT_HTTP_ERROR_FALLBACK;404',
    ]) {
      const error = Object.assign(new Error('framework control flow'), { digest });
      expect(isExpectedRequestControlFlow(error)).toBe(true);
      const sentry = { captureRequestError: vi.fn() };
      expect(forwardServerRequestError(error, {}, {}, { sentry })).toBe(false);
      expect(sentry.captureRequestError).not.toHaveBeenCalled();
    }
  });

  it('keeps the Next instrumentation hook wired to the forwarding helper', () => {
    const source = readFileSync(new URL('../instrumentation.js', import.meta.url), 'utf8');
    expect(source).toContain('forwardServerRequestError(err, request, context)');
    expect(source).toContain('context?.routePath || request?.path || request?.url');
  });

  it('applies the same PII scrubber to Node and Edge Sentry events', () => {
    for (const file of ['sentry.server.config.mjs', 'sentry.edge.config.mjs']) {
      const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
      expect(source).toContain('sendDefaultPii: false');
      expect(source).toContain('beforeSend: scrubSentryEvent');
      expect(source).toContain('beforeBreadcrumb: scrubSentryBreadcrumb');
    }
  });

  it('composes browser noise filtering with URL and breadcrumb redaction', () => {
    const source = readFileSync(
      new URL('../instrumentation-client.js', import.meta.url),
      'utf8',
    );
    expect(source).toContain('sendDefaultPii: false');
    expect(source).toContain('return scrubSentryEvent(event)');
    expect(source).toContain('beforeBreadcrumb: scrubSentryBreadcrumb');
  });
});

describe('operational alerts', () => {
  it('groups, redacts, and throttles repeated signals', () => {
    const scope = sentryScope();
    const sentry = {
      isInitialized: () => true,
      withScope: vi.fn(callback => callback(scope)),
    };
    let current = 10_000;
    const report = createOperationalReporter({ sentry, now: () => current });

    expect(report('webhook_processing_failed', {
      error: new Error('person@example.test token=secret'),
      data: { provider: 'flutterwave', amount: 50_000 },
    })).toBe(true);
    expect(report('webhook_processing_failed')).toBe(false);

    expect(scope.setTag).toHaveBeenCalledWith(
      'operational.signal',
      'webhook_processing_failed',
    );
    expect(scope.setFingerprint).toHaveBeenCalledWith([
      'nitro-operational',
      'webhook_processing_failed',
      'webhook_processing_failed',
    ]);
    expect(scope.setContext).toHaveBeenCalledWith('operational', {
      signal: 'webhook_processing_failed',
      provider: 'flutterwave',
      amount: '[redacted]',
    });
    const captured = scope.captureException.mock.calls[0][0];
    expect(captured.message).not.toContain('person@example.test');
    expect(captured.message).not.toContain('secret');

    current += 5 * 60 * 1000;
    expect(report('webhook_processing_failed')).toBe(true);
  });

  it('never propagates a monitoring SDK failure', () => {
    const report = createOperationalReporter({
      sentry: {
        isInitialized: () => true,
        withScope: () => { throw new Error('Sentry unavailable'); },
      },
    });
    expect(() => report('redis_unavailable')).not.toThrow();
    expect(report('redis_unavailable')).toBe(false);
  });
});
