import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { log } from "@/lib/logger";

// `nigeriaOnly` is a fact about the rail, not a preference — whether it can
// take money from outside Nigeria at all.
//
// Flutterwave is charged in NGN, and an international card pays an NGN charge
// perfectly well: the cardholder's own bank does the conversion. So it stays
// visible everywhere, and only its Nigerian halves (bank transfer, mobile
// money) are unavailable abroad — `abroadDesc` says so rather than listing
// methods that will not work. I had this wrong when the gate first shipped and
// hid Flutterwave from every foreign account, which removed the one card path
// they had.
//
// The Nigerian bank rails are genuinely local: ALATPay and Monnify debit
// Nigerian accounts and manual transfer is a Nigerian account number. KoraPay
// takes cards but whether it accepts foreign ones is unconfirmed, so it stays
// hidden until someone checks — a method that fails is worse than one that is
// missing. An unrecognised gateway is treated as Nigerian for the same reason.
const DEFAULTS = {
  flutterwave: { name: 'Flutterwave', desc: 'Cards, Bank Transfer, Mobile Money', abroadDesc: 'Card payment', priority: 1, nigeriaOnly: false },
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
            desc: (abroad && def.abroadDesc) || data.desc || def.desc || '',
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
