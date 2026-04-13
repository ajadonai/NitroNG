// Email sending via Brevo (formerly Sendinblue)
// Docs: https://developers.brevo.com/reference/sendtransacemail

import { fetchWithRetry } from '@/lib/fetch';

const BREVO_KEY = process.env.BREVO_API_KEY;
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'noreply@nitro.ng';
const SENDER_NAME = process.env.SENDER_NAME || 'The Nitro NG';

/**
 * Send an email via Brevo
 * @param {string} to - recipient email
 * @param {string} subject
 * @param {string} html - HTML body
 * @param {string} text - plain text fallback
 */
export async function sendEmail(to, subject, html, text = '') {
  if (!BREVO_KEY) {
    console.warn('[Email] BREVO_API_KEY not set — logging email instead');
    console.log(`[Email] To: ${to} | Subject: ${subject}`);
    return { success: false, reason: 'no_api_key' };
  }

  try {
    const res = await fetchWithRetry('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
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

/**
 * Send verification code email
 */
export async function sendVerificationEmail(to, name, code) {
  const subject = `${code} is your Nitro verification code`;
  const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <table width="48" height="48" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;"><tr><td align="center" valign="middle" width="48" height="48" style="border-radius: 14px; background-color: #c47d8e; font-size: 22px; font-weight: 700; color: #ffffff; font-family: Arial, sans-serif;">N</td></tr></table>
      </div>
      <h1 style="font-size: 22px; font-weight: 600; color: #1a1a1a; text-align: center; margin-bottom: 8px;">Verify your email</h1>
      <p style="font-size: 15px; color: #666; text-align: center; margin-bottom: 30px;">Hi ${name}, enter this code to complete your signup:</p>
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; padding: 16px 32px; background: #f5f3f0; border-radius: 12px; font-family: 'JetBrains Mono', monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #1a1a1a;">${code}</div>
      </div>
      <p style="font-size: 13px; color: #999; text-align: center;">This code expires in 30 minutes. If you didn't sign up for Nitro, ignore this email.</p>
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
        <p style="font-size: 12px; color: #bbb;">Nitro — Premium SMM Services</p>
      </div>
    </div>
  `;
  return sendEmail(to, subject, html, `Your verification code is: ${code}`);
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(to, name, resetUrl) {
  const subject = 'Reset your Nitro password';
  const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <table width="48" height="48" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;"><tr><td align="center" valign="middle" width="48" height="48" style="border-radius: 14px; background-color: #c47d8e; font-size: 22px; font-weight: 700; color: #ffffff; font-family: Arial, sans-serif;">N</td></tr></table>
      </div>
      <h1 style="font-size: 22px; font-weight: 600; color: #1a1a1a; text-align: center; margin-bottom: 8px;">Reset your password</h1>
      <p style="font-size: 15px; color: #666; text-align: center; margin-bottom: 30px;">Hi ${name}, click the button below to reset your password:</p>
      <div style="text-align: center; margin-bottom: 30px;">
        <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #c47d8e, #a3586b); color: #fff; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 10px;">Reset Password</a>
      </div>
      <p style="font-size: 13px; color: #999; text-align: center;">This link expires in 30 minutes. If you didn't request a reset, ignore this email.</p>
      <p style="font-size: 12px; color: #bbb; text-align: center; margin-top: 8px;">Or copy this link: ${resetUrl}</p>
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
        <p style="font-size: 12px; color: #bbb;">Nitro — Premium SMM Services</p>
      </div>
    </div>
  `;
  return sendEmail(to, subject, html, `Reset your password: ${resetUrl}`);
}

/**
 * Send referral bonus notification
 */
export async function sendReferralBonusEmail(to, name, amount, referredName) {
  const subject = `You earned ₦${amount.toLocaleString()} from a referral!`;
  const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <table width="48" height="48" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;"><tr><td align="center" valign="middle" width="48" height="48" style="border-radius: 14px; background-color: #c47d8e; font-size: 22px; font-weight: 700; color: #ffffff; font-family: Arial, sans-serif;">N</td></tr></table>
      </div>
      <h1 style="font-size: 22px; font-weight: 600; color: #1a1a1a; text-align: center; margin-bottom: 8px;">Referral bonus credited! 🎉</h1>
      <p style="font-size: 15px; color: #666; text-align: center; margin-bottom: 20px;">Hi ${name}, ${referredName} signed up using your referral link.</p>
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; padding: 16px 32px; background: #ecfdf5; border-radius: 12px; font-family: 'JetBrains Mono', monospace; font-size: 28px; font-weight: 700; color: #059669;">₦${amount.toLocaleString()}</div>
      </div>
      <p style="font-size: 14px; color: #666; text-align: center;">has been added to your wallet balance.</p>
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
        <p style="font-size: 12px; color: #bbb;">Nitro — Premium SMM Services</p>
      </div>
    </div>
  `;
  return sendEmail(to, subject, html);
}
