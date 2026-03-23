// Generate display IDs like ORD-28491, TK-401
export function generateOrderId() {
  const num = Math.floor(10000 + Math.random() * 90000);
  return `ORD-${num}`;
}

export function generateTicketId() {
  const num = Math.floor(100 + Math.random() * 900);
  return `TK-${num}`;
}

// Generate referral code like BOOST-A8B2
export function generateReferralCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'BOOST-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// 6-digit email verification code
export function generateVerifyCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Standard JSON response helpers
export function ok(data, status = 200) {
  return Response.json(data, { status });
}

export function error(message, status = 400) {
  return Response.json({ error: message }, { status });
}
