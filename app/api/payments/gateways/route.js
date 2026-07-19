import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";

const DEFAULTS = {
  flutterwave: { name: 'Flutterwave', desc: 'Cards, Bank Transfer, Mobile Money', priority: 1 },
  alatpay: { name: 'ALATPay (Wema)', desc: 'Direct bank debit', priority: 2 },
  monnify: { name: 'Monnify', desc: 'Auto-confirmed bank transfer', priority: 3 },
  korapay: { name: 'KoraPay', desc: 'Cards, Bank Transfer', priority: 4 },
  crypto: { name: 'Crypto', desc: 'USDT (TRC-20 / ERC-20)', priority: 5 },
  manual: { name: 'Manual Transfer', desc: 'Direct bank transfer', priority: 6 },
};

export async function GET() {
  try {
    const settings = await prisma.setting.findMany({
      where: { key: { startsWith: 'gateway_' } },
    });

    const gateways = [];
    settings.forEach(s => {
      try {
        const id = s.key.replace('gateway_', '');
        const data = JSON.parse(s.value);
        if (data.enabled) {
          const def = DEFAULTS[id] || {};
          gateways.push({
            id,
            name: data.name || def.name || id,
            desc: data.desc || def.desc || '',
            priority: data.priority ?? def.priority ?? 99,
          });
        }
      } catch {}
    });

    gateways.sort((a, b) => a.priority - b.priority);

    return Response.json({ gateways });
  } catch (err) {
    log.error('Gateways GET', err.message);
    return Response.json({ gateways: [] });
  }
}
