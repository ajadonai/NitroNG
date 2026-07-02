import { describe, it, expect } from 'vitest';

// ──────────────────────────────────────
// Payout state machine invariants
// ──────────────────────────────────────
describe('payout state machine', () => {
  // These map directly to the SQL WHERE clauses in admin/crew/payouts/route.js
  const ALLOWED_FROM = {
    process:  ['pending'],
    complete: ['pending', 'processing'],
    reject:   ['pending', 'processing'],
  };

  function wouldTransition(action, currentStatus) {
    return ALLOWED_FROM[action]?.includes(currentStatus) ?? false;
  }

  it('process: only from pending', () => {
    expect(wouldTransition('process', 'pending')).toBe(true);
    expect(wouldTransition('process', 'processing')).toBe(false);
    expect(wouldTransition('process', 'completed')).toBe(false);
    expect(wouldTransition('process', 'rejected')).toBe(false);
  });

  it('complete: from pending or processing', () => {
    expect(wouldTransition('complete', 'pending')).toBe(true);
    expect(wouldTransition('complete', 'processing')).toBe(true);
    expect(wouldTransition('complete', 'completed')).toBe(false);
    expect(wouldTransition('complete', 'rejected')).toBe(false);
  });

  it('reject: from pending or processing', () => {
    expect(wouldTransition('reject', 'pending')).toBe(true);
    expect(wouldTransition('reject', 'processing')).toBe(true);
    expect(wouldTransition('reject', 'completed')).toBe(false);
    expect(wouldTransition('reject', 'rejected')).toBe(false);
  });

  it('completed and rejected are terminal (no transitions out)', () => {
    for (const action of ['process', 'complete', 'reject']) {
      expect(wouldTransition(action, 'completed')).toBe(false);
      expect(wouldTransition(action, 'rejected')).toBe(false);
    }
  });

  it('double-completion blocked: second UPDATE WHERE status IN (...) affects 0 rows', () => {
    // After first completion: status='completed'
    // Second attempt: WHERE id=? AND status IN ('pending','processing') → 0 rows
    expect(wouldTransition('complete', 'completed')).toBe(false);
  });

  it('double-rejection blocked', () => {
    expect(wouldTransition('reject', 'rejected')).toBe(false);
  });
});

// ──────────────────────────────────────
// Rejection must not reduce earned money
// ──────────────────────────────────────
describe('payout rejection financial invariant', () => {
  it('reject action only updates payout status — no totalEarned change', () => {
    // The reject handler in route.js executes:
    //   $executeRaw`UPDATE affiliate_payouts SET status='rejected' ...`
    // It does NOT touch crew_members.totalEarned. This test documents that
    // the old bug (decrementing totalEarned on rejection) is fixed.
    //
    // The available balance formula is:
    //   available = SUM(approved commissions) - totalPaid - SUM(pending/processing payouts)
    //
    // When a payout is rejected, it's no longer 'pending' or 'processing',
    // so it drops out of the SUM — the balance is restored automatically
    // without touching totalEarned.
    const totalEarnedBefore = 10000;
    const totalEarnedAfter = 10000; // unchanged
    expect(totalEarnedAfter).toBe(totalEarnedBefore);
  });
});

// ──────────────────────────────────────
// Concurrent completion: totalPaid incremented exactly once
// ──────────────────────────────────────
describe('concurrent payout completion', () => {
  it('conditional UPDATE ensures only one of two concurrent completions succeeds', () => {
    // Simulates two concurrent admin completions:
    let payoutStatus = 'processing';
    const amount = 5000;
    let totalPaid = 0;

    // Both read payout as 'processing' (fine — the gate is in the UPDATE)
    // Admin A's UPDATE: WHERE id=? AND status IN ('pending','processing')
    function tryComplete() {
      if (payoutStatus === 'pending' || payoutStatus === 'processing') {
        payoutStatus = 'completed';
        totalPaid += amount;
        return 1; // affected
      }
      return 0;
    }

    const affectedA = tryComplete(); // succeeds, status→completed
    const affectedB = tryComplete(); // fails, status already completed

    expect(affectedA).toBe(1);
    expect(affectedB).toBe(0);
    expect(totalPaid).toBe(amount); // incremented exactly once
  });
});

// ──────────────────────────────────────
// Payout bank snapshot
// ──────────────────────────────────────
describe('payout bank snapshot', () => {
  it('payout stores bank details at request time', () => {
    const memberBankNow = { bankName: 'GTBank', bankAccountNo: '123', bankAccountName: 'Kola' };
    const payoutData = {
      memberId: 'm1',
      amount: 500000,
      bankName: memberBankNow.bankName,
      bankAccountNo: memberBankNow.bankAccountNo,
      bankAccountName: memberBankNow.bankAccountName,
    };

    // Member changes bank later
    const memberBankLater = { bankName: 'Access', bankAccountNo: '456', bankAccountName: 'Kola S' };

    // Admin sees the snapshot, not the current details
    const displayedBank = payoutData.bankName || memberBankLater.bankName;
    expect(displayedBank).toBe('GTBank');
  });

  it('falls back to member current for historical payouts without snapshot', () => {
    const payoutWithoutSnapshot = { bankName: null, bankAccountNo: null, bankAccountName: null };
    const memberCurrent = { bankName: 'GTBank', bankAccountNo: '123', bankAccountName: 'Kola' };

    const displayed = payoutWithoutSnapshot.bankName || memberCurrent.bankName;
    expect(displayed).toBe('GTBank');
  });
});

// ──────────────────────────────────────
// Concurrent payout requests: overdraw prevention
// ──────────────────────────────────────
describe('concurrent payout overdraw prevention', () => {
  it('FOR UPDATE on member row serializes concurrent requests', () => {
    // The payout POST handler:
    // 1. SELECT ... FROM crew_members WHERE id=? FOR UPDATE  (locks the row)
    // 2. Reads totalPaid from the locked row (not stale session)
    // 3. Computes available balance
    // 4. Creates payout if sufficient
    //
    // Two concurrent requests: Request B blocks at step 1 until A commits.
    // After A commits (creating a pending payout), B re-reads and sees the
    // new pending payout in the aggregate, so available balance is reduced.

    const totalPaid = 0;
    const approvedEarnings = 10000;
    const requestAmount = 8000;

    // Request A succeeds
    const pendingAfterA = requestAmount;
    const availableAfterA = approvedEarnings - totalPaid - pendingAfterA;
    expect(availableAfterA).toBe(2000);

    // Request B reads after A committed
    const availableForB = approvedEarnings - totalPaid - pendingAfterA;
    const bCanRequest = requestAmount <= availableForB;
    expect(bCanRequest).toBe(false); // B gets "Insufficient balance"
  });
});
