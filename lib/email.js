import { fetchWithRetry } from '@/lib/fetch';

const BREVO_KEY = process.env.BREVO_API_KEY;
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'noreply@nitro.ng';
const SENDER_NAME = process.env.SENDER_NAME || 'The Nitro NG';

// ═══ BRANDED EMAIL WRAPPER ═══
function emailWrap({ label, labelBg, labelColor, title, body, footer }) {
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
    <div style="padding:20px 32px 28px;text-align:center;">
      <p style="font-size:12px;color:#bbb;margin:0 0 12px;">Nitro — Premium SMM services for Nigerian creators</p>
      ${footer || `<div style="display:inline-flex;gap:12px;">
        <a href="https://instagram.com/nitro.ng" style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;background:#f5f3f0;text-decoration:none;">
          <img src="https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/instagram.svg" width="14" height="14" style="opacity:.4;" alt="IG" />
        </a>
        <a href="https://x.com/TheNitroNG" style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;background:#f5f3f0;text-decoration:none;">
          <img src="https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/x.svg" width="14" height="14" style="opacity:.4;" alt="X" />
        </a>
      </div>`}
    </div>
  </div>
  <p style="text-align:center;font-size:11px;color:#bbb;margin:20px 0 0;">You're receiving this because you have a Nitro account.<br/>nitro.ng</p>
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

// ═══ VERIFICATION CODE ═══
export async function sendVerificationEmail(to, name, code) {
  const subject = `${code} is your Nitro verification code`;
  const html = emailWrap({
    label: 'Verification', labelBg: '#f0eaff', labelColor: '#6b4fcf',
    title: 'Verify your email',
    body: `
      <p style="font-size:15px;line-height:1.65;color:#555;margin:0 0 24px;">Hi ${name}, enter this code to complete your signup:</p>
      <div style="text-align:center;padding:18px 24px;background:#f8f6f3;border-radius:12px;font-family:'Courier New',monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:#1a1a1a;margin:0 0 24px;">${code}</div>
      <p style="font-size:13px;color:#999;text-align:center;margin:0;">This code expires in 30 minutes. If you didn't sign up for Nitro, ignore this email.</p>
    `,
  });
  return sendEmail(to, subject, html, `Your verification code is: ${code}`);
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

// ═══ REFERRAL BONUS ═══
export async function sendReferralBonusEmail(to, name, amount, referredName) {
  const subject = `You earned ₦${amount.toLocaleString()} from a referral!`;
  const html = emailWrap({
    label: 'Referral', labelBg: '#fef3c7', labelColor: '#b45309',
    title: 'You earned a referral bonus',
    body: `
      <p style="font-size:15px;line-height:1.65;color:#555;margin:0 0 24px;">Hi ${name}, ${referredName} signed up using your referral link.</p>
      <div style="text-align:center;padding:16px 24px;background:#fef3c7;border-radius:12px;margin:0 0 24px;">
        <div style="font-family:'Courier New',monospace;font-size:30px;font-weight:700;color:#b45309;">+₦${amount.toLocaleString()}</div>
        <div style="font-size:13px;color:#b45309;margin-top:4px;">Referral bonus credited</div>
      </div>
      <div style="text-align:center;margin:0 0 24px;"><a href="https://nitro.ng/dashboard" style="display:inline-block;padding:14px 32px;background:#c47d8e;color:#fff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">View your wallet</a></div>
      <p style="font-size:13px;color:#999;text-align:center;margin:0;">Keep sharing your referral code to earn more.</p>
    `,
  });
  return sendEmail(to, subject, html);
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
