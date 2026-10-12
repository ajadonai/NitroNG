/**
 * Exact decimal arithmetic on amount strings, with no float involved.
 *
 * Crypto amounts arrive as strings with up to 18 decimal places. Parsing those
 * with Number() loses precision silently: 0.1 + 0.2 is the textbook case, and
 * on a payment comparison that is the difference between "paid in full" and
 * "underpaid by a dust amount". Everything here stays in string space.
 *
 * Extracted unchanged from the NOWPayments verification module when Cryptomus
 * replaced it, because none of this was ever provider specific and the bounds
 * below were tuned against real payloads.
 */

const MAX_DECIMAL_INPUT_LENGTH = 512;
const MAX_DECIMAL_EXPONENT = 1_024;
const MAX_CANONICAL_DECIMAL_LENGTH = 2_048;
const MAX_DECIMAL_PRECISION = 36;
const MAX_DECIMAL_SCALE = 18;

function decimalLikeString(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? String(value) : null;
  }
  if (typeof value === 'bigint') return value >= 0n ? value.toString() : null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  try {
    const prototype = Object.getPrototypeOf(value);
    if (!prototype || prototype === Object.prototype) return null;
    const constructorName = String(value.constructor?.name || '');
    const tag = String(value[Symbol.toStringTag] || '');
    if (!/decimal/i.test(constructorName) && !/decimal/i.test(tag)) return null;
    if (typeof value.toString !== 'function') return null;
    const rendered = value.toString();
    return typeof rendered === 'string' ? rendered.trim() : null;
  } catch {
    return null;
  }
}

export function canonicalizeNonNegativeDecimal(value) {
  const source = decimalLikeString(value);
  if (!source || source.length > MAX_DECIMAL_INPUT_LENGTH) return null;

  const match = source.match(/^\+?(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/);
  if (!match) return null;

  const integerDigits = match[1] ?? '0';
  const fractionDigits = match[1] !== undefined ? (match[2] || '') : match[3];
  const exponentText = match[4] || '0';
  if (exponentText.replace(/^[+-]?0*/, '').length > 4) return null;
  const exponent = Number(exponentText);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > MAX_DECIMAL_EXPONENT) return null;

  const allDigits = `${integerDigits}${fractionDigits}`;
  const decimalPosition = integerDigits.length + exponent;
  let expanded;
  if (decimalPosition <= 0) {
    expanded = `0.${'0'.repeat(-decimalPosition)}${allDigits}`;
  } else if (decimalPosition >= allDigits.length) {
    expanded = `${allDigits}${'0'.repeat(decimalPosition - allDigits.length)}`;
  } else {
    expanded = `${allDigits.slice(0, decimalPosition)}.${allDigits.slice(decimalPosition)}`;
  }
  if (expanded.length > MAX_CANONICAL_DECIMAL_LENGTH) return null;

  const [rawInteger, rawFraction = ''] = expanded.split('.');
  const canonicalInteger = rawInteger.replace(/^0+(?=\d)/, '') || '0';
  const canonicalFraction = rawFraction.replace(/0+$/, '');
  const canonicalIntegerDigits = canonicalInteger === '0' ? 0 : canonicalInteger.length;
  if (
    canonicalIntegerDigits > MAX_DECIMAL_PRECISION - MAX_DECIMAL_SCALE
    || canonicalFraction.length > MAX_DECIMAL_SCALE
    || canonicalIntegerDigits + canonicalFraction.length > MAX_DECIMAL_PRECISION
  ) {
    return null;
  }
  return canonicalFraction ? `${canonicalInteger}.${canonicalFraction}` : canonicalInteger;
}

export function compareNonNegativeDecimals(left, right) {
  const canonicalLeft = canonicalizeNonNegativeDecimal(left);
  const canonicalRight = canonicalizeNonNegativeDecimal(right);
  if (canonicalLeft === null || canonicalRight === null) return null;
  if (canonicalLeft === canonicalRight) return 0;

  const [leftInteger, leftFraction = ''] = canonicalLeft.split('.');
  const [rightInteger, rightFraction = ''] = canonicalRight.split('.');
  if (leftInteger.length !== rightInteger.length) {
    return leftInteger.length < rightInteger.length ? -1 : 1;
  }
  if (leftInteger !== rightInteger) return leftInteger < rightInteger ? -1 : 1;

  const fractionLength = Math.max(leftFraction.length, rightFraction.length);
  const paddedLeft = leftFraction.padEnd(fractionLength, '0');
  const paddedRight = rightFraction.padEnd(fractionLength, '0');
  if (paddedLeft === paddedRight) return 0;
  return paddedLeft < paddedRight ? -1 : 1;
}

export function equalNonNegativeDecimals(left, right) {
  return compareNonNegativeDecimals(left, right) === 0;
}

function toScaledBigInt(canonical, scale) {
  const [integer, fraction = ''] = canonical.split('.');
  return BigInt(`${integer}${fraction.padEnd(scale, '0')}`);
}

/**
 * Compare `left` against `right × numerator/denominator`, still without a float.
 *
 * This exists for tolerance questions — "did at least 95% of what we asked for
 * arrive", "is this no more than 5% over" — where writing `left <= right * 1.05`
 * would reintroduce exactly the precision loss the rest of this module avoids.
 * The ratio is given as two integers so it has no decimal of its own.
 *
 * Returns -1, 0 or 1 like compareNonNegativeDecimals, or null if either amount
 * is unparseable or the ratio is not two sane positive integers. A null must be
 * treated as "do not know", never as a pass.
 */
export function compareDecimalToScaled(left, right, numerator, denominator) {
  const canonicalLeft = canonicalizeNonNegativeDecimal(left);
  const canonicalRight = canonicalizeNonNegativeDecimal(right);
  if (canonicalLeft === null || canonicalRight === null) return null;
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator)) return null;
  if (numerator < 0 || denominator <= 0) return null;

  const scale = Math.max(
    (canonicalLeft.split('.')[1] || '').length,
    (canonicalRight.split('.')[1] || '').length,
  );
  const scaledLeft = toScaledBigInt(canonicalLeft, scale) * BigInt(denominator);
  const scaledRight = toScaledBigInt(canonicalRight, scale) * BigInt(numerator);
  if (scaledLeft === scaledRight) return 0;
  return scaledLeft < scaledRight ? -1 : 1;
}
