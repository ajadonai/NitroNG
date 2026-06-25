const TOKEN = process.env.CREW_BOT_TOKEN;
const GROUP = process.env.CREW_GROUP_ID;
const API = `https://api.telegram.org/bot${TOKEN}`;

const TOPICS = {
  activity: process.env.CREW_TOPIC_ACTIVITY,
  leaderboard: process.env.CREW_TOPIC_LEADERBOARD,
  wins: process.env.CREW_TOPIC_WINS,
  announcements: process.env.CREW_TOPIC_ANNOUNCEMENTS,
  welcome: null, // default/General topic — no thread ID needed
};

function sendToTopic(topic, text) {
  if (!TOKEN || !GROUP) return;
  const threadId = TOPICS[topic];
  fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: GROUP,
      ...(threadId ? { message_thread_id: Number(threadId) } : {}),
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  }).catch(() => {});
}

export async function sendDM(chatId, text) {
  if (!TOKEN) return false;
  try {
    const res = await fetch(`${API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    const data = await res.json();
    return data.ok;
  } catch {
    return false;
  }
}

export function replyInGroup(chatId, messageId, text) {
  if (!TOKEN) return;
  fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, reply_to_message_id: messageId, text, parse_mode: 'HTML' }),
  }).catch(() => {});
}

// ── Welcome (default topic) ──────────────────────────
export function crewWelcome(memberName, teamName) {
  sendToTopic('welcome', `👋 Welcome <b>${memberName}</b> to <b>Team ${teamName}</b>!`);
}

// ── Activity Feed ─────────────────────────────────────
export function crewSignup(memberName) {
  sendToTopic('activity', `👤 A referral from <b>${memberName}</b> just signed up`);
}

export function crewFirstPurchase(memberName) {
  sendToTopic('activity', `🛒 A referral from <b>${memberName}</b> just made their first purchase`);
}

export function crewRepeatBuyer(memberName, count) {
  sendToTopic('activity', `🔄 A referral from <b>${memberName}</b> just placed their ${ordinal(count)} order`);
}

export function crewLeadChange(leadTeam, leadCount, trailTeam, trailCount) {
  sendToTopic('activity', `🔥 <b>Team ${leadTeam}</b> just took the lead — ${leadCount} orders vs <b>Team ${trailTeam}</b>'s ${trailCount}`);
}

// ── Wins ──────────────────────────────────────────────
export function crewFirstBlood(memberName) {
  sendToTopic('wins', `⚡ First conversion of the day goes to <b>${memberName}</b>!`);
}

export function crewMilestone(memberName, count) {
  sendToTopic('wins', `🏅 <b>${memberName}</b> just hit ${count} total referral orders!`);
}

export function crewStreak(memberName, days) {
  sendToTopic('wins', `🔥 <b>${memberName}</b> — ${days}-day referral streak!`);
}

export function crewWeeklyWinner(teamName, count) {
  sendToTopic('wins', `🏆 <b>Team ${teamName}</b> wins this week with ${count} referral orders!`);
}

export function crewMonthlyChampion(teamName) {
  sendToTopic('wins', `👑 <b>Team ${teamName}</b> is the monthly champion!`);
}

// ── Leaderboard (posted by cron) ──────────────────────
export function crewLeaderboard(text) {
  sendToTopic('leaderboard', text);
}

// ── Announcements ─────────────────────────────────────
export function crewAnnouncement(text) {
  sendToTopic('announcements', text);
}

export function crewDailyTip(text) {
  sendToTopic('announcements', `💡 <b>Tip of the day</b>\n\n${text}`);
}

// ── Personal DM notifications ─────────────────────────
export function crewDmCommission(telegramUserId, amount) {
  sendDM(telegramUserId, `💰 You earned <b>${amount}</b> from a referral's order!`);
}

export function crewDmPayout(telegramUserId, amount) {
  sendDM(telegramUserId, `✅ Your payout of <b>${amount}</b> has been sent to your bank.`);
}

export function crewDmNewSignup(telegramUserId) {
  sendDM(telegramUserId, `👤 Someone just signed up via your link!`);
}

export function crewDmFirstPurchase(telegramUserId) {
  sendDM(telegramUserId, `🛒 One of your referrals just made their first purchase!`);
}

export function crewDmInactive(telegramUserId, days) {
  sendDM(telegramUserId, `Hey! It's been ${days} days since your last referral activity. Your link is still live — time to get back out there.`);
}

export function crewDmChiefNewLink(telegramUserId, memberName) {
  sendDM(telegramUserId, `🔗 <b>${memberName}</b> just linked their Telegram account.`);
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
