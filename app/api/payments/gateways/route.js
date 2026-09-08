import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { log } from "@/lib/logger";

// `nigeriaOnly` is a fact about the rail, not a preference. Flutterwave is
// hardcoded to NGN; ALATPay, Monnify and KoraPay collect through Nigerian
// banks; manual transfer is a Nigerian account number. Only USDT works from
// anywhere. Signup accepts five countries, so without this a customer in
// London met six methods, five of which could only fail — and found out by
// failing. A gateway id we do not recognise is treated as Nigerian, since
// every rail added so far has been.
const DEFAULTS = {
  flutterwave: { name: 'Flutterwave', desc: 'Cards, Bank Transfer, Mobile Money', priority: 1, nigeriaOnly: true },
  alatpay: { name: 'ALATPay (Wema)', desc: 'Direct bank debit', priority: 2, nigeriaOnly: true },
  monnify: { name: 'Monnify', desc: 'Auto-confirmed bank transfer', priority: 3, nigeriaOnly: true },
  korapay: { name: 'KoraPay', desc: 'Cards, Bank Transfer', priority: 4, nigeriaOnly: true },
  crypto: { name: 'Crypto', desc: 'USDT (TRC-20 / ERC-20)', priority: 5, nigeriaOnly: false },
  manual: { name: 'Manual Transfer', desc: 'Direct bank transfer', priority: 6, nigeriaOnly: true },
};

// Where the customer is, from their account. No session — the wallet is behind
// login, so this is only ever a direct call — reads as Nigeria, which is the
// list this route always returned before.
async function customerCountry() {
  try {
    const me = await getCurrentUser();
    if (!me?.id) return 'NG';
    const u = await prisma.user.findUnique({ where: { id: me.id }, select: { country: true } });
    return u?.country || 'NG';
  } catch {
    return 'NG';
  }
}

export async function GET() {
  try {
    const [settings, country] = await Promise.all([
      prisma.setting.findMany({ where: { key: { startsWith: 'gateway_' } } }),
      customerCountry(),
    ]);
    const abroad = country !== 'NG';

    const gateways = [];
    let hiddenNigeriaOnly = 0;
    settings.forEach(s => {
      try {
        const id = s.key.replace('gateway_', '');
        const data = JSON.parse(s.value);
        if (data.enabled) {
          const def = DEFAULTS[id] || {};
          if (abroad && (def.nigeriaOnly ?? true)) { hiddenNigeriaOnly++; return; }
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

    // The count lets the wallet say why the list is short, from the same
    // decision that shortened it, so the two can never disagree.
    return Response.json({ gateways, country, hiddenNigeriaOnly });
  } catch (err) {
    log.error('Gateways GET', err.message);
    return Response.json({ gateways: [] });
  }
}
