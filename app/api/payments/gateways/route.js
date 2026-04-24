import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";

const GATEWAY_INFO = {
  flutterwave: { name: 'Flutterwave', desc: 'Cards, Bank Transfer, Mobile Money' },
  alatpay: { name: 'ALATPay (Wema)', desc: 'Direct bank debit' },
  monnify: { name: 'Monnify', desc: 'Auto-confirmed bank transfer' },
  korapay: { name: 'KoraPay', desc: 'Cards, Bank Transfer' },
  crypto: { name: 'Crypto', desc: 'USDT (TRC-20 / ERC-20)' },
  manual: { name: 'Bank Transfer', desc: 'Manual bank transfer' },
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
          const info = GATEWAY_INFO[id] || { name: data.name || id, desc: data.desc || '' };
          gateways.push({
            id,
            name: data.name || info.name,
            desc: data.desc || info.desc,
            priority: data.priority || 99,
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
