// Server-side validation — never trust client input

export function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function validatePhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

export function validatePassword(pw) {
  if (!pw || typeof pw !== 'string') return false;
  return pw.length >= 6 && pw.length <= 128;
}

export function validateName(name) {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 100) return false;
  // Only letters, spaces, hyphens, apostrophes, periods
  return /^[a-zA-ZÀ-ÿ\s'\-\.]+$/.test(trimmed);
}

export function sanitizeString(str, maxLength = 500) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().slice(0, maxLength);
}

export function sanitizeEmail(email) {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase().slice(0, 254);
}
