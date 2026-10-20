/**
 * Naira ↔ kobo, in one place.
 *
 * A hand-kept copy of the staff portal's file — the repos share no package,
 * the same arrangement the messaging models use. Change one, change all.
 *
 * The API speaks KOBO — integers of the smallest unit — and the UI speaks
 * naira, because nobody types a fee in kobo. Every crossing of that boundary
 * goes through here: a `* 100` scattered through components is how one field
 * ends up out by a factor of a hundred, and a fee is the worst possible place
 * to find that out.
 *
 * ## Why this parses a string instead of multiplying
 *
 * The obvious implementation is `Math.round(naira * 100)`, and it is subtly
 * wrong. `1.005` is not representable in binary: it is really
 * `1.00499999999999989…`, so `1.005 * 100` is `100.49999999999999` and
 * `Math.round` gives **100 instead of 101**. Reading the decimal digits out of
 * the string and doing integer arithmetic has no such failure mode — the only
 * multiplication left is on a whole number, which is exact.
 */

/** `-` then digits, optionally a `.` and more digits. Anything else is unusual. */
const DECIMAL = /^(-)?(\d*)(?:\.(\d*))?$/;

/**
 * `'37,500.50'` → `3750050`. Always a whole number of kobo.
 *
 * Anything beyond two decimal places is rounded to the nearest kobo, because
 * a third of a kobo is not a thing that exists.
 */
export function toKobo(naira: number | string | null | undefined): number {
  if (naira === null || naira === undefined || naira === '') return 0;

  const raw = String(naira).trim().replace(/,/g, '');
  if (!raw) return 0;

  const match = DECIMAL.exec(raw);
  if (!match) {
    // Exponent notation and other oddities — nothing a person types into a
    // fee box, but better rounded than silently zero.
    const value = Number(raw);
    return Number.isFinite(value) ? Math.round(value * 100) : 0;
  }

  const sign = match[1] ? -1 : 1;
  const whole = match[2] || '0';
  const fraction = match[3] ?? '';

  // `whole` is an integer, so this multiplication is exact.
  const kobo = Number(whole) * 100 + Number(`${fraction}00`.slice(0, 2));

  // Round on the third decimal digit if the user typed one.
  const thirdDigit = fraction.charAt(2);
  const rounded = thirdDigit && Number(thirdDigit) >= 5 ? kobo + 1 : kobo;

  return sign * rounded;
}

/** `3750050` → `37500.5`, for putting back into a number input. */
export function toNaira(kobo: number | null | undefined): number {
  if (!kobo) return 0;
  return kobo / 100;
}

/** `3750050` → `₦37,500.50`. What a Head reads. */
export function formatNaira(kobo: number | null | undefined): string {
  const value = toNaira(kobo);
  return `₦${value.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
