#!/usr/bin/env node
// Find and fix any users/admins with plaintext passwords (not bcrypt hashes)
// Usage: node scripts/hash-plaintext-passwords.mjs          (dry run)
//        node scripts/hash-plaintext-passwords.mjs --apply  (fix them)

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

async function main() {
  console.log(apply ? 'APPLYING...\n' : 'DRY RUN\n');

  const users = await prisma.user.findMany({ select: { id: true, email: true, password: true } });
  const admins = await prisma.admin.findMany({ select: { id: true, email: true, password: true } });

  let found = 0;

  for (const table of [{ name: 'users', rows: users, model: prisma.user }, { name: 'admins', rows: admins, model: prisma.admin }]) {
    for (const row of table.rows) {
      if (!row.password || row.password === '') continue;
      if (row.password.startsWith('$2b$') || row.password.startsWith('$2a$')) continue;

      found++;
      console.log(`  ${table.name}: ${row.email} — plaintext password found (${row.password.length} chars)`);

      if (apply) {
        const hashed = await bcrypt.hash(row.password, 12);
        await table.model.update({ where: { id: row.id }, data: { password: hashed } });
        console.log(`    → hashed and saved`);
      }
    }
  }

  if (found === 0) console.log('No plaintext passwords found.');
  else console.log(`\n${found} plaintext password(s) ${apply ? 'fixed' : 'found'}.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
