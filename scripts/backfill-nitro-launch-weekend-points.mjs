#!/usr/bin/env node
// Retired one-time backfill: the launch-weekend award has already completed.
// Pure calculation helpers remain exported for historical regression tests.

import { isMainModule } from './lib/guarded-operation.mjs';

// Saturday Jul 11 00:00 WAT  →  2026-07-10T23:00:00.000Z
// Monday   Jul 13 12:12 WAT  →  rewards commit deployed (97b5696)
export const WINDOW_START = new Date('2026-07-10T23:00:00.000Z');
export const WINDOW_END = new Date('2026-07-13T12:12:40.000Z');

const DEDUPE_PREFIX = 'launch_weekend_points';
export const EXECUTION_RETIRED = true;

export function makeDedupeKey(orderDbId) {
  return `${DEDUPE_PREFIX}:${orderDbId}`;
}

export function computeEligibleCharge(charge, refunded, bonusUsed, pointsRedeemed) {
  return Math.max(0, charge - refunded - bonusUsed - pointsRedeemed);
}

export function isInWindow(date) {
  return date >= WINDOW_START && date < WINDOW_END;
}

export function isEligibleStatus(status) {
  return status === 'Completed' || status === 'Partial';
}

export function refuseRetiredExecution() {
  throw new Error(
    'Launch-weekend Nitro Points backfill is retired and cannot be executed. Use a reviewed forward migration or a new guarded operation.',
  );
}

if (isMainModule(import.meta.url)) {
  try {
    refuseRetiredExecution();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
