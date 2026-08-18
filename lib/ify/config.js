// lib/ify/config.js
// Central config + feature flags for the Nitro bot (lean v1 + outreach).
// Everything is env-driven so you can tune behaviour without a logic redeploy.

export const IFY = {
  // Master switch, opt-in. Must be set to exactly "true" to run; anything else,
  // including unset, keeps the bot silent in both directions.
  //
  // Deliberately fails closed. The outreach cron already calls sendOutreach() for
  // every contact in every batch, so a permissive default meant the bot would
  // start template-messaging the whole pipeline the moment WhatsApp credentials
  // appeared in the environment — with no confirmation and no soft launch.
  enabled: process.env.IFY_ENABLED === 'true',

  // Soft-launch allowlist: comma-separated WhatsApp numbers (digits, e.g. 2348012345678).
  // Empty = nobody. Add a handful of test numbers to begin, then widen.
  allowlist: (process.env.IFY_ALLOWLIST || '')
    .split(',')
    .map((s) => s.replace(/\D/g, ''))
    .filter(Boolean),

  // Customer-facing name. NOTE: the strategy docs call this "Ify"; the live outreach
  // templates are signed "Ify". Pick ONE and set IFY_PERSONA so it's consistent everywhere.
  persona: {
    name: process.env.IFY_PERSONA || 'Ify',
    // Suggest a human after this many AI replies if the issue isn't resolved (spec: 2–3).
    maxAiTurns: Number(process.env.IFY_MAX_AI_TURNS || 3),
  },

  wa: {
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
    appSecret: process.env.WHATSAPP_APP_SECRET || '',
    token: process.env.WHATSAPP_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    graphVersion: process.env.WHATSAPP_GRAPH_VERSION || 'v21.0',
  },

  llm: {
    apiKey: process.env.OPENAI_API_KEY || '',
    baseUrl: process.env.IFY_LLM_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.IFY_MODEL || 'gpt-4o-mini',
    maxTokens: Number(process.env.IFY_MAX_TOKENS || 500),
    temperature: Number(process.env.IFY_TEMPERATURE || 0.3),
  },

  memory: {
    turns: Number(process.env.IFY_MEMORY_TURNS || 8),
    ttlSec: Number(process.env.IFY_MEMORY_TTL || 60 * 60 * 6), // 6h
  },

  limits: {
    userPerMin: Number(process.env.IFY_RL_USER || 8),
    nonUserPerDay: Number(process.env.IFY_RL_NONUSER || 20),
  },

  // After a handoff, the bot stays in "human" mode this long so it doesn't talk over a person.
  humanModeTtlSec: Number(process.env.IFY_HUMAN_TTL || 60 * 60 * 12), // 12h
  // Short auto-quiet (legacy pause) — kept for compatibility.
  pauseOnHandoffSec: Number(process.env.IFY_HANDOFF_PAUSE || 60 * 30),

  // PROMISES — open-commitment tracking.
  promises: {
    enabled: process.env.IFY_PROMISES_ENABLED !== 'false',
    dueSoonMinutes: Number(process.env.IFY_PROMISE_SOON_MIN || 30),
    escalateAfterMinutes: Number(process.env.IFY_PROMISE_ESC_MIN || 60),
    nightCutoff: 22,
    morningStart: 9,
    dueWindows: {
      order_status: 1,
      provider_chase: 'eod',
      refill: 'eod',
      payment: 'eod',
      refund_routing: 'eod',
      escalation: 2,
      other: 4,
    },
    sheet: {
      id: process.env.IFY_PROMISE_SHEET_ID || '',
      saKey: process.env.IFY_PROMISE_SHEET_SA_KEY || '',
    },
  },

  // OUTBOUND OUTREACH.
  // Business-initiated WhatsApp messages MUST use pre-approved templates. These are the
  // template NAMES you register in Meta — their copy must mirror OUTREACH_MESSAGES in
  // lib/telegram.js, with {{1}},{{2}}… placeholders (see docs/OUTREACH_INTEGRATION.md).
  outreach: {
    langCode: process.env.IFY_TPL_LANG || 'en',
    templates: {
      day1: process.env.IFY_TPL_DAY1 || 'nitro_day1_nudge',
      day3: process.env.IFY_TPL_DAY3 || 'nitro_day3_howto',
      day7: process.env.IFY_TPL_DAY7 || 'nitro_day7_last',
      firstDeposit: process.env.IFY_TPL_DEPOSIT || 'nitro_first_deposit',
      firstOrder: process.env.IFY_TPL_ORDER || 'nitro_first_order',
      winback: process.env.IFY_TPL_WINBACK || 'nitro_winback',
    },
  },
};

// Soft-launch gate.
// Gates both outbound templates and inbound replies. An empty allowlist means
// nobody, so credentials alone can never open the bot to the whole user base.
export function isAllowed(waNumber) {
  if (!IFY.allowlist.length) return false;
  return IFY.allowlist.includes((waNumber || '').replace(/\D/g, ''));
}
