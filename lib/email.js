import { fetchWithRetry } from '@/lib/fetch';

const BREVO_KEY = process.env.BREVO_API_KEY;
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'noreply@nitro.ng';
const SENDER_NAME = process.env.SENDER_NAME || 'Ify from Nitro';

// ═══ BRANDED EMAIL WRAPPER ═══
export function emailWrap({ label, labelBg, labelColor, title, body, footer }) {
  return `
<div style="background:#f4f1ed;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
    <div style="background:#1a1520;padding:28px 32px 24px;text-align:center;">
      <table width="42" height="42" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr><td align="center" valign="middle" width="42" height="42" style="border-radius:12px;background-color:#c47d8e;">
        <img src="https://nitro.ng/favicon.png" width="20" height="20" alt="N" style="display:block;margin:0 auto;" />
      </td></tr></table>
      <div style="font-size:13px;font-weight:600;letter-spacing:2px;color:rgba(255,255,255,.5);text-transform:uppercase;margin-top:8px;">Nitro</div>
    </div>
    <div style="padding:32px;">
      <div style="display:inline-block;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;padding:4px 10px;border-radius:6px;margin-bottom:16px;background:${labelBg};color:${labelColor};">${label}</div>
      <h1 style="font-size:22px;font-weight:600;color:#1a1a1a;margin:0 0 8px;">${title}</h1>
      ${body}
    </div>
    <div style="height:1px;background:#f0eee8;margin:0 32px;"></div>
    ${footer || `<div style="padding:20px 32px 12px;text-align:center;">
      <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>
        <td style="padding:0 6px;"><a href="https://instagram.com/nitro.ng" style="display:block;width:32px;height:32px;border-radius:8px;background:#f5f3f0;text-decoration:none;text-align:center;line-height:32px;">
          <img src="https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/instagram.svg" width="14" height="14" style="opacity:.4;vertical-align:middle;" alt="IG" />
        </a></td>
        <td style="padding:0 6px;"><a href="https://x.com/TheNitroNG" style="display:block;width:32px;height:32px;border-radius:8px;background:#f5f3f0;text-decoration:none;text-align:center;line-height:32px;">
          <img src="https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/x.svg" width="14" height="14" style="opacity:.4;vertical-align:middle;" alt="X" />
        </a></td>
      </tr></table>
    </div>`}
    <div style="padding:0 32px 28px;text-align:right;">
      <p style="font-size:12px;color:#bbb;margin:0;">Nitro. Premium SMM for Nigerian creators.</p>
    </div>
  </div>
  <p style="text-align:right;font-size:11px;color:#bbb;margin:20px 0 0;">You're receiving this because you have a Nitro account.<br/><a href="https://nitro.ng/dashboard?page=settings#set-notifications" style="color:#bbb;text-decoration:underline;">Manage notification preferences</a></p>
</div>`;
}

// ═══ SEND EMAIL VIA BREVO ═══
export async function sendEmail(to, subject, html, text = '') {
  if (!BREVO_KEY) {
    console.warn('[Email] BREVO_API_KEY not set — logging email instead');
    console.log(`[Email] To: ${to} | Subject: ${subject}`);
    return { success: false, reason: 'no_api_key' };
  }
  try {
    const res = await fetchWithRetry('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text || subject,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      console.log(`[Email] Sent to ${to}: ${subject} (messageId: ${data.messageId})`);
      return { success: true, messageId: data.messageId };
    } else {
      const err = await res.text();
      console.error(`[Email] Failed (${res.status}):`, err);
      return { success: false, reason: err };
    }
  } catch (err) {
    console.error('[Email] Send error:', err.message);
    return { success: false, reason: err.message };
  }
}

// ═══ WELCOME EMAIL ═══
export async function sendWelcomeEmail(name, to) {
  const subject = "Welcome to Nitro! Let's get you growing";
  const html = emailWrap({
    label: 'Welcome', labelBg: 'rgba(196,125,142,.1)', labelColor: '#c47d8e',
    title: 'Welcome to Nitro 🚀',
    body: `
      <p style="font-size:15px;line-height:1.65;color:#555;margin:0 0 20px;">Hi ${name},</p>
      <p style="font-size:15px;line-height:1.65;color:#555;margin:0 0 20px;">You're in. Nitro is the platform Nigerian creators, artists, and businesses use to grow their social media. Real followers, likes, views, and engagement across every major platform.</p>
      <p style="font-size:15px;line-height:1.65;color:#555;margin:0 0 24px;">Fund your wallet and place your first order. Most orders start delivering in seconds.</p>
      <div style="text-align:center;margin:0 0 24px;"><a href="https://nitro.ng/dashboard" style="display:inline-block;padding:14px 32px;background:#c47d8e;color:#fff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">Go to your dashboard</a></div>
      <div style="padding:14px 16px;background:#f8f6f3;border-radius:10px;margin:0 0 20px;">
        <p style="font-size:14px;line-height:1.6;color:#555;margin:0;">💡 <strong>Got friends who need a boost?</strong> Share your referral link from the dashboard and you both earn a bonus on their first deposit.</p>
      </div>
      <p style="font-size:13px;color:#999;margin:0;">Questions? Reach us at <a href="mailto:support@nitro.ng" style="color:#c47d8e;text-decoration:none;font-weight:600;">support@nitro.ng</a>. We respond fast.</p>
    `,
  });
  return sendEmail(to, subject, html, `Welcome to Nitro, ${name}! Go to your dashboard: https://nitro.ng/dashboard`);
}

// ═══ PASSWORD RESET ═══
export async function sendPasswordResetEmail(to, name, resetUrl) {
  const subject = 'Reset your Nitro password';
  const html = emailWrap({
    label: 'Security', labelBg: '#fef2f2', labelColor: '#dc2626',
    title: 'Reset your password',
    body: `
      <p style="font-size:15px;line-height:1.65;color:#555;margin:0 0 24px;">Hi ${name}, we received a request to reset your password. Click the button below to choose a new one:</p>
      <div style="text-align:center;margin:0 0 24px;"><a href="${resetUrl}" style="display:inline-block;padding:14px 32px;background:#c47d8e;color:#fff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">Reset password</a></div>
      <p style="font-size:13px;color:#999;text-align:center;margin:0 0 4px;">This link expires in 30 minutes.</p>
      <p style="font-size:12px;color:#bbb;text-align:center;margin:0;">Or copy: ${resetUrl}</p>
    `,
  });
  return sendEmail(to, subject, html, `Reset your password: ${resetUrl}`);
}

// ═══ WALLET CREDIT (used by admin credit/gift + leaderboard reward) ═══
export function walletCreditEmail(name, amount, reason) {
  return emailWrap({
    label: 'Wallet', labelBg: '#ecfdf5', labelColor: '#059669',
    title: reason || 'Balance credited',
    body: `
      <p style="font-size:15px;line-height:1.65;color:#555;margin:0 0 24px;">Hi ${name}, your Nitro wallet has been topped up:</p>
      <div style="text-align:center;padding:16px 24px;background:#ecfdf5;border-radius:12px;margin:0 0 24px;">
        <div style="font-family:'Courier New',monospace;font-size:30px;font-weight:700;color:#059669;">+₦${amount.toLocaleString()}</div>
        <div style="font-size:13px;color:#059669;margin-top:4px;">Added to your wallet</div>
      </div>
      <div style="text-align:center;margin:0 0 24px;"><a href="https://nitro.ng/dashboard" style="display:inline-block;padding:14px 32px;background:#c47d8e;color:#fff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">Check your balance</a></div>
    `,
  });
}

// ═══ ACCOUNT DELETION ═══
export function accountDeletionEmail(name, daysLeft) {
  return emailWrap({
    label: 'Account', labelBg: '#fef2f2', labelColor: '#dc2626',
    title: 'Your account is scheduled for deletion',
    body: `
      <p style="font-size:15px;line-height:1.65;color:#555;margin:0 0 24px;">Hi ${name}, your Nitro account has been scheduled for permanent deletion in <strong>${daysLeft} days</strong>.</p>
      <p style="font-size:15px;line-height:1.65;color:#555;margin:0 0 24px;">If this was a mistake, contact us at <a href="mailto:support@nitro.ng" style="color:#c47d8e;text-decoration:none;font-weight:600;">support@nitro.ng</a> to cancel the deletion.</p>
      <p style="font-size:13px;color:#999;margin:0;">After deletion, your data cannot be recovered.</p>
    `,
  });
}

// ═══ LEADERBOARD REWARD ═══
export function leaderboardRewardEmail(name, amount) {
  return emailWrap({
    label: 'Reward', labelBg: '#fef3c7', labelColor: '#b45309',
    title: 'You received a reward!',
    body: `
      <p style="font-size:15px;line-height:1.65;color:#555;margin:0 0 24px;">Hi ${name}, congratulations on making it to the Nitro leaderboard!</p>
      <div style="text-align:center;padding:16px 24px;background:#fef3c7;border-radius:12px;margin:0 0 24px;">
        <div style="font-family:'Courier New',monospace;font-size:30px;font-weight:700;color:#b45309;">+₦${amount.toLocaleString()}</div>
        <div style="font-size:13px;color:#b45309;margin-top:4px;">Leaderboard reward</div>
      </div>
      <div style="text-align:center;margin:0 0 24px;"><a href="https://nitro.ng/dashboard" style="display:inline-block;padding:14px 32px;background:#c47d8e;color:#fff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">View your wallet</a></div>
    `,
  });
}

// ═══ BULK ORDER PLACEMENT ═══
export function batchPlacementEmail(name, batchId, total, placed, failed, totalCharge) {
  return emailWrap({
    label: 'Bulk Order', labelBg: 'rgba(196,125,142,.1)', labelColor: '#c47d8e',
    title: `${total} orders placed`,
    body: `
      <p style="font-size:15px;line-height:1.65;color:#555;margin:0 0 24px;">Hi ${name}, your bulk order has been submitted.</p>
      <div style="background:#f8f8f8;border-radius:12px;padding:16px;margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;"><span style="color:#888;">Batch</span><span style="color:#333;font-weight:500;">${batchId}</span></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;"><span style="color:#888;">Total orders</span><span style="color:#333;font-weight:500;">${total}</span></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;"><span style="color:#888;">Processing</span><span style="color:#059669;font-weight:600;">${placed}</span></div>
        ${failed > 0 ? `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;"><span style="color:#888;">Pending retry</span><span style="color:#d97706;font-weight:600;">${failed}</span></div>` : ''}
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;border-top:1px solid #eee;margin-top:4px;padding-top:10px;"><span style="color:#888;">Total charged</span><span style="color:#333;font-weight:700;">₦${totalCharge.toLocaleString()}</span></div>
      </div>
      ${failed > 0 ? '<p style="font-size:13px;color:#888;margin:0 0 20px;">Pending orders will be retried automatically. If they can\'t be placed, you\'ll be refunded.</p>' : ''}
      <div style="text-align:center;"><a href="https://nitro.ng/dashboard" style="display:inline-block;padding:14px 32px;background:#c47d8e;color:#fff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">View Orders</a></div>
    `,
  });
}

// ═══ BULK ORDER COMPLETION ═══
export function batchCompletionEmail(name, batchId, completed, partial, cancelled, refunded) {
  const refundLine = refunded > 0 ? `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;"><span style="color:#888;">Refunded</span><span style="color:#059669;font-weight:600;">₦${refunded.toLocaleString()}</span></div>` : '';
  return emailWrap({
    label: 'Batch Complete', labelBg: 'rgba(34,197,94,.1)', labelColor: '#22c55e',
    title: `Batch ${batchId} complete`,
    body: `
      <p style="font-size:15px;line-height:1.65;color:#555;margin:0 0 24px;">Hi ${name}, all orders in your batch have finished processing.</p>
      <div style="background:#f8f8f8;border-radius:12px;padding:16px;margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;"><span style="color:#888;">Completed</span><span style="color:#059669;font-weight:600;">${completed}</span></div>
        ${partial > 0 ? `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;"><span style="color:#888;">Partial</span><span style="color:#d97706;font-weight:600;">${partial}</span></div>` : ''}
        ${cancelled > 0 ? `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;"><span style="color:#888;">Cancelled</span><span style="color:#dc2626;font-weight:600;">${cancelled}</span></div>` : ''}
        ${refundLine}
      </div>
      <div style="text-align:center;"><a href="https://nitro.ng/dashboard" style="display:inline-block;padding:14px 32px;background:#c47d8e;color:#fff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">View Orders</a></div>
    `,
  });
}
