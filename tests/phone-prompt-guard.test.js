import { describe, expect, it } from 'vitest';

const {
  advancePhoneGeneration,
  createPhoneConfirmation,
  isCurrentPhoneRequest,
  mergeDashboardUser,
  reconcilePhoneConfirmation,
  shouldShowPhonePrompt,
} = await import('@/components/dashboard');

describe('phone prompt visibility guard', () => {
  it('suppresses the popup when server data loaded with a phone', () => {
    expect(shouldShowPhonePrompt({
      phoneKnown: true,
      user: { name: 'Kolanut Inc', phone: '+2348066088463' },
      currentTosVersion: null,
    })).toBe(false);
  });

  it('shows the popup when server data confirms no phone', () => {
    expect(shouldShowPhonePrompt({
      phoneKnown: true,
      user: { name: 'New User', phone: '' },
      currentTosVersion: null,
    })).toBe(true);
  });

  it('suppresses the popup on cold load when dashboard API fails (phoneKnown stays false)', () => {
    expect(shouldShowPhonePrompt({
      phoneKnown: false,
      user: { name: 'User', email: '', balance: 0, phone: '' },
      currentTosVersion: null,
    })).toBe(false);
  });

  it('suppresses the popup when initialData has phone but maintenance check throws (phoneKnown from initialData)', () => {
    expect(shouldShowPhonePrompt({
      phoneKnown: true,
      user: { name: 'Kolanut Inc', phone: '+2348066088463' },
      currentTosVersion: null,
    })).toBe(false);
  });

  it('does not trust an empty server-rendered phone until the identity endpoint confirms it', () => {
    expect(createPhoneConfirmation({ id: 'user-1', phone: '' })).toEqual({
      userId: 'user-1',
      phone: null,
    });
  });

  it('allows the identity endpoint to authoritatively confirm a missing phone', () => {
    expect(reconcilePhoneConfirmation(
      { userId: 'user-1', phone: null },
      { id: 'user-1', phone: '' },
      { authoritative: true, allowClear: true },
    )).toEqual({ userId: 'user-1', phone: '' });
  });

  it('allows a fresh no-store dashboard response to confirm a missing phone', () => {
    expect(reconcilePhoneConfirmation(
      { userId: 'user-1', phone: null },
      { id: 'user-1', phone: '' },
      { authoritative: true, allowClear: true },
    )).toEqual({ userId: 'user-1', phone: '' });
  });

  it('does not let a dashboard request opened before save clear the newly confirmed phone', () => {
    expect(reconcilePhoneConfirmation(
      { userId: 'user-1', phone: '+2348066088463' },
      { id: 'user-1', phone: '' },
      { authoritative: true },
    )).toEqual({ userId: 'user-1', phone: '+2348066088463' });
  });

  it('makes same-generation dashboard reads stale after identity confirms a phone', () => {
    const dashboardRequestGeneration = 4;
    const generationAfterIdentity = advancePhoneGeneration(
      dashboardRequestGeneration,
      '+2348066088463',
    );

    expect(generationAfterIdentity).toBe(5);
    expect(isCurrentPhoneRequest(dashboardRequestGeneration, generationAfterIdentity)).toBe(false);
  });

  it('does not let a stale dashboard response erase a confirmed phone', () => {
    expect(reconcilePhoneConfirmation(
      { userId: 'user-1', phone: '+2348066088463' },
      { id: 'user-1', phone: '' },
    )).toEqual({ userId: 'user-1', phone: '+2348066088463' });

    expect(mergeDashboardUser(
      { id: 'user-1', name: 'Kolanut Inc', phone: '+2348066088463' },
      { id: 'user-1', name: 'Kolanut Inc', phone: '' },
    )).toEqual({ id: 'user-1', name: 'Kolanut Inc', phone: '+2348066088463' });
  });

  it('does not treat an incomplete dashboard user as proof that the phone is missing', () => {
    expect(reconcilePhoneConfirmation(
      { userId: 'user-1', phone: null },
      { id: 'user-1', name: 'Kolanut Inc' },
    )).toEqual({ userId: 'user-1', phone: null });
  });

  it('drops the prior account confirmation when the authenticated user changes', () => {
    expect(reconcilePhoneConfirmation(
      { userId: 'user-1', phone: '+2348066088463' },
      { id: 'user-2', phone: '' },
    )).toEqual({ userId: 'user-2', phone: null });
  });
});
