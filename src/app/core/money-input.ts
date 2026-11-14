/**
 * Typing money (2026-11-11): commas appear as the amount is typed, and the
 * amount is read back in words beneath the box — "₦1,250,000" is easy to
 * mistype by a zero, "One million, two hundred and fifty thousand naira" is
 * not. Amounts here are naira as typed; `toKobo` (which ignores commas) is
 * still the only way into kobo.
 */

/**
 * `'1250000.5'` → `'1,250,000.5'` while typing. Keeps digits and one decimal
 * point, at most two decimals; drops anything else (a pasted "₦", a space).
 */
export function formatNairaInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, '');
  const point = cleaned.indexOf('.');
  const wholeDigits = (point === -1 ? cleaned : cleaned.slice(0, point)).replace(/^0+(?=\d)/, '');
  const fraction = point === -1 ? null : cleaned.slice(point + 1).replace(/\./g, '').slice(0, 2);
  const whole = wholeDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (fraction === null) return whole;
  return `${whole || '0'}.${fraction}`;
}

/**
 * Where the caret belongs after reformatting: just after the same number of
 * digits (and decimal point) it followed before — so typing in the middle of
 * "1,250,000" does not throw the caret to the end.
 */
export function caretAfterFormat(before: string, caret: number, after: string): number {
  const significant = before.slice(0, caret).replace(/[^\d.]/g, '').length;
  if (significant === 0) return 0;
  let seen = 0;
  for (let index = 0; index < after.length; index += 1) {
    if (/[\d.]/.test(after[index])) seen += 1;
    if (seen === significant) return index + 1;
  }
  return after.length;
}

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
  'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALES = ['', 'thousand', 'million', 'billion', 'trillion'];

/** 0–999 in words, British style: "one hundred and five". */
function underThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(`${ONES[hundreds]} hundred`);
  if (rest) {
    const words = rest < 20 ? ONES[rest] : TENS[Math.floor(rest / 10)] + (rest % 10 ? `-${ONES[rest % 10]}` : '');
    parts.push(hundreds ? `and ${words}` : words);
  }
  return parts.join(' ');
}

/** A whole number in words: "one million, two hundred and fifty thousand". */
export function numberInWords(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '';
  let n = Math.floor(value);
  if (n === 0) return 'zero';

  const groups: number[] = [];
  while (n > 0) {
    groups.push(n % 1000);
    n = Math.floor(n / 1000);
  }
  if (groups.length > SCALES.length) return '';

  const parts: string[] = [];
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const group = groups[index];
    if (!group) continue;
    parts.push(`${underThousand(group)}${SCALES[index] ? ` ${SCALES[index]}` : ''}`);
  }
  // "one thousand and fifty": a last group under a hundred joins with "and".
  const last = groups[0];
  if (parts.length > 1 && last > 0 && last < 100) {
    const tail = parts.pop()!;
    return `${parts.join(', ')} and ${tail}`;
  }
  return parts.join(', ');
}

/**
 * Kobo in words, the way it is written on a cheque or a bank slip:
 * "One hundred thousand naira", "Fifty naira and fifty kobo". Empty for
 * nothing typed.
 */
export function nairaInWords(kobo: number): string {
  if (!Number.isInteger(kobo) || kobo <= 0) return '';
  const naira = Math.floor(kobo / 100);
  const remainder = kobo % 100;
  const parts: string[] = [];
  if (naira) parts.push(`${numberInWords(naira)} naira`);
  if (remainder) parts.push(`${numberInWords(remainder)} kobo`);
  const words = parts.join(' and ');
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : '';
}
