/**
 * Backfill frozen referral attribution for existing users.
 *
 * For users with a signupSource but no referredByMemberId, resolves the
 * acquisition link and freezes the affiliate member and link IDs.
 *
 * Safe: only writes to users that haven't been backfilled yet. Idempotent.
 *
 * Usage:
 *   DRY_RUN=1 node scripts/backfill-referral-attribution.mjs   # preview
 *   node scripts/backfill-referral-attribution.mjs               # apply
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === '1';

async function main() {
  const users = await prisma.user.findMany({
    where: {
      signupSource: { not: null },
      referredByMemberId: null,
      deletedAt: null,
    },
    select: { id: true, signupSource: true },
  });

  console.log(`Found ${users.length} users to backfill${DRY_RUN ? ' (dry run)' : ''}`);

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

    if (DRY_RUN) {
      console.log(`  [dry] ${user.id} → member=${link.affiliateId}, link=${link.id}`);
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

  console.log(`Done. Updated: ${updated}, Skipped (no link): ${skipped}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
