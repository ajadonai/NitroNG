#!/usr/bin/env node
// Pull full service catalogues from MTP, JAP, and DaoSMM
// Usage: node scripts/pull-providers.mjs

import 'dotenv/config';
import fs from 'fs';

const PROVIDERS = {
  mtp: {
    name: 'MoreThanPanel',
    url: process.env.MTP_API_URL || 'https://morethanpanel.com/api/v2',
    key: process.env.MTP_API_KEY,
  },
  jap: {
    name: 'JustAnotherPanel',
    url: process.env.JAP_API_URL || 'https://justanotherpanel.com/api/v2',
    key: process.env.JAP_API_KEY,
  },
  dao: {
    name: 'DaoSMM',
    url: process.env.DAOSMM_API_URL || 'https://daosmm.com/api/v2',
    key: process.env.DAOSMM_API_KEY,
  },
};

async function fetchServices(id, provider) {
  if (!provider.key) {
    console.log(`  ⚠ ${id.toUpperCase()} API key not configured, skipping`);
    return null;
  }
  const body = new URLSearchParams({ key: provider.key, action: 'services' });
  const res = await fetch(provider.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json();
  if (data.error) throw new Error(`${id}: ${data.error}`);
  return data;
}

async function main() {
  console.log('Pulling provider catalogues...\n');

  for (const [id, provider] of Object.entries(PROVIDERS)) {
    console.log(`→ ${provider.name} (${id})...`);
    try {
      const services = await fetchServices(id, provider);
      if (!services) continue;

      const arr = Array.isArray(services) ? services : Object.values(services);
      console.log(`  ✓ ${arr.length} services`);

      // Write raw JSON
      fs.writeFileSync(`scripts/${id}-services.json`, JSON.stringify(arr, null, 2));
      console.log(`  Written to scripts/${id}-services.json`);
    } catch (err) {
      console.error(`  ✗ Error: ${err.message}`);
    }
  }

  console.log('\nDone. Now searching for replacement services...\n');

  // Load the catalogues and search for correct services for the 17 mismatched tiers
  const mismatches = [
    { group: 'Audiomack Streams — Nigeria', search: ['audiomack', 'stream', 'nigeria'], platform: 'audiomack', type: 'plays' },
    { group: 'Boomplay Streams — Nigeria', search: ['boomplay', 'stream', 'nigeria'], platform: 'boomplay', type: 'plays' },
    { group: 'Facebook Custom Comments', search: ['facebook', 'custom comment'], platform: 'facebook', type: 'comments' },
    { group: 'Facebook Random Comments', search: ['facebook', 'random comment'], platform: 'facebook', type: 'comments' },
    { group: 'Instagram Custom Comments', search: ['instagram', 'custom comment'], platform: 'instagram', type: 'comments' },
    { group: 'Instagram Random Comments', search: ['instagram', 'random comment'], platform: 'instagram', type: 'comments' },
    { group: 'Instagram Emoji Comments', search: ['instagram', 'emoji comment'], platform: 'instagram', type: 'comments' },
    { group: 'Spotify Followers — Nigeria', search: ['spotify', 'follower', 'nigeria'], platform: 'spotify', type: 'followers' },
    { group: 'TikTok Followers (global)', search: ['tiktok', 'follower'], platform: 'tiktok', type: 'followers', excludeGeo: true },
    { group: 'TikTok Custom Comments', search: ['tiktok', 'custom comment'], platform: 'tiktok', type: 'comments' },
    { group: 'TikTok Random Comments', search: ['tiktok', 'random comment'], platform: 'tiktok', type: 'comments' },
    { group: 'YouTube Custom Comments', search: ['youtube', 'custom comment'], platform: 'youtube', type: 'comments' },
    { group: 'YouTube Random Comments', search: ['youtube', 'random comment'], platform: 'youtube', type: 'comments' },
    { group: 'YouTube Watch Time', search: ['youtube', 'watch time'], platform: 'youtube', type: 'views' },
  ];

  let report = '# Provider Service Alternatives for Mismatched Tiers\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;

  for (const [id] of Object.entries(PROVIDERS)) {
    const path = `scripts/${id}-services.json`;
    if (!fs.existsSync(path)) continue;

    const services = JSON.parse(fs.readFileSync(path, 'utf-8'));
    report += `## ${id.toUpperCase()} (${services.length} total services)\n\n`;

    for (const mm of mismatches) {
      const platformTerms = [mm.platform];
      const typeTerms = mm.type === 'comments' ? ['comment'] :
                        mm.type === 'followers' ? ['follower', 'subscriber'] :
                        mm.type === 'plays' ? ['play', 'stream'] :
                        mm.type === 'views' ? ['view', 'watch'] : [];

      const matches = services.filter(svc => {
        const name = (svc.name || '').toLowerCase();
        const cat = (svc.category || '').toLowerCase();
        const combined = name + ' ' + cat;

        // Must match platform
        if (!platformTerms.some(t => combined.includes(t))) return false;
        // Must match type
        if (!typeTerms.some(t => combined.includes(t))) return false;
        // For Nigerian-specific, check for nigeria
        if (mm.search.includes('nigeria') && !combined.includes('nigeria')) return false;
        // For non-geo, skip country-specific
        if (mm.excludeGeo && /nigeria|usa|turkey|india|brazil/i.test(name)) return false;

        return true;
      });

      if (matches.length > 0) {
        report += `### ${mm.group}\n`;
        report += `| Service ID | Name | Rate/1k | Min | Max | Refill |\n`;
        report += `|------------|------|---------|-----|-----|--------|\n`;
        // Show up to 10 best matches, sorted by rate
        const sorted = matches.sort((a, b) => parseFloat(a.rate) - parseFloat(b.rate));
        for (const s of sorted.slice(0, 10)) {
          report += `| ${s.service} | ${s.name} | $${s.rate} | ${s.min} | ${s.max} | ${s.refill ? 'Yes' : 'No'} |\n`;
        }
        report += '\n';
      }
    }
    report += '---\n\n';
  }

  fs.writeFileSync('docs/provider-alternatives.md', report);
  console.log('Written replacement options to docs/provider-alternatives.md');
}

main().catch(console.error);
