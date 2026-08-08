const SCRIPT_OPERATION = 'seed-tasks';

async function main({ prisma, dryRun }) {
  const existingTasks = await prisma.task.findMany();
  console.log(`Found ${existingTasks.length} existing task(s)`);

  // Deactivate all existing tasks
  if (existingTasks.length > 0) {
    if (!dryRun) {
      await prisma.task.updateMany({ data: { active: false } });
    }
    console.log(`${dryRun ? '[DRY RUN] Would deactivate' : 'Deactivated'} ${existingTasks.length} existing task(s)`);
  }

  // Create the Follow Nitro on X task
  const taskData = {
    platform: 'x',
    title: 'Follow Nitro on X',
    instructions: 'Follow @nitaborng on X (Twitter). Enter your X handle below so we can verify the follow. Make sure your account is public.',
    category: 'quick_wins',
    proofType: 'handle',
    reward: 30000, // ₦300 in kobo
    frequency: 'one_time',
    maxPerMonth: 0,
    minViews: 0,
    minFollowers: 0,
    keepDays: 0,
    monthlyCap: 0,
    viralBonus: false,
    viralThreshold: 0,
    viralAmount: 0,
    allowNonDepositors: true,
    active: true,
    sortOrder: 0,
  };

  const existing = existingTasks.find(t => t.platform === 'x' && t.title === 'Follow Nitro on X');
  if (existing) {
    if (!dryRun) {
      await prisma.task.update({ where: { id: existing.id }, data: { ...taskData } });
    }
    console.log(`${dryRun ? '[DRY RUN] Would update' : 'Updated'} task: Follow Nitro on X (id: ${existing.id})`);
  } else {
    if (!dryRun) {
      const task = await prisma.task.create({ data: taskData });
      console.log(`Created task: Follow Nitro on X (id: ${task.id})`);
    } else {
      console.log('[DRY RUN] Would create task: Follow Nitro on X');
    }
  }

  // Set task_monthly_budget to ₦100K = 10,000,000 kobo
  if (!dryRun) {
    await prisma.setting.upsert({
      where: { key: 'task_monthly_budget' },
      update: { value: '10000000' },
      create: { key: 'task_monthly_budget', value: '10000000' },
    });
  }
  console.log(`${dryRun ? '[DRY RUN] Would set' : 'Set'} task_monthly_budget = 10,000,000 kobo (₦100K)`);

  // Set task_credit_expiry_days to 30
  if (!dryRun) {
    await prisma.setting.upsert({
      where: { key: 'task_credit_expiry_days' },
      update: { value: '30' },
      create: { key: 'task_credit_expiry_days', value: '30' },
    });
  }
  console.log(`${dryRun ? '[DRY RUN] Would set' : 'Set'} task_credit_expiry_days = 30`);

  return { dryRun };
}

if (require.main === module) {
  import('./lib/guarded-operation.mjs')
    .then(({ runGuardedPrismaScript }) => runGuardedPrismaScript({
      operation: SCRIPT_OPERATION,
      main,
    }))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}

module.exports = { SCRIPT_OPERATION, main };
