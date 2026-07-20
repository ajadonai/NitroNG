/**
 * Backfill frozen referral attribution for existing users.
 *
 * For users with a signupSource but no referredByMemberId, resolves the
 * acquisition link and freezes the affiliate member and link IDs.
 *
 * Idempotent, local/test-only, and read-only unless apply mode is confirmed.
 *
 * Usage:
 *   node scripts/backfill-referral-attribution.mjs             # preview
 *   NITRO_SCRIPT_MODE=apply NITRO_SCRIPT_CONFIRM=<phrase> ...  # apply
 */
import {
  isMainModule,
  runGuardedPrismaScript,
} from './lib/guarded-operation.mjs';

export const SCRIPT_OPERATION = 'backfill-referral-attribution';

export async function main({ prisma, dryRun, logger = console }) {
  const users = await prisma.user.findMany({
    where: {
      signupSource: { not: null },
      referredByMemberId: null,
      deletedAt: null,
    },
    select: { id: true, signupSource: true },
  });

  logger.log(`Found ${users.length} users to backfill${dryRun ? ' (dry run)' : ''}`);

  const slugs = [...new Set(users.map(u => u.signupSource))];
  const links = await prisma.acquisitionLink.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true, affiliateId: true },
  });
  const linkMap = Object.fromEntries(links.map(l => [l.slug, l]));

  let updated = 0;
  let skipped = 0;

  for (const user of users) {
    const link = linkMap[user.signupSource];
    if (!link?.affiliateId) {
      skipped++;
      continue;
    }

    if (dryRun) {
      logger.log(`  [dry] ${user.id} → member=${link.affiliateId}, link=${link.id}`);
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          referredByMemberId: link.affiliateId,
          referredByLinkId: link.id,
        },
      });
    }
    updated++;
  }

  logger.log(`${dryRun ? 'Preview complete' : 'Done'}. ${dryRun ? 'Would update' : 'Updated'}: ${updated}, Skipped (no link): ${skipped}`);
  return { dryRun, updated, skipped };
}

if (isMainModule(import.meta.url)) {
  runGuardedPrismaScript({ operation: SCRIPT_OPERATION, main })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
