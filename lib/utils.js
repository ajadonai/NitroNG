export function generateOrderId() {
  return `NTR-${Date.now()}`;
}

export function generateTicketId() {
  return `TKT-${Date.now()}`;
}

export function generateReferralCode() {
  const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789';
  let code = 'NTR-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Standard JSON response helpers
export function ok(data, status = 200) {
  return Response.json(data, { status });
}

export function error(message, status = 400) {
  return Response.json({ error: message }, { status });
}
