/**
 * Day labels for a conversation, the way WhatsApp does them.
 *
 * A bare clock time is ambiguous the moment a thread is older than a day:
 * "8:36 PM" on its own cannot tell you whether a Head answered last night or
 * last month, which matters when a message is the record of when somebody was
 * told something. So the conversation carries a day separator above the first
 * message of each day, and the thread list shows a day instead of a time once
 * the last message is no longer from today.
 *
 * Everything here works in the READER'S LOCAL TIME. A message sent at 00:30
 * belongs to the day the reader would call it, not to whatever UTC says — and
 * comparing ISO strings or UTC dates gets that wrong for exactly the people
 * most likely to be messaging late at night.
 */

/** Midnight local time on the day containing `value`. */
function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

/** Whole days between two local midnights. Negative means `value` is ahead. */
function daysAgo(value: Date, now: Date): number {
  const MS_PER_DAY = 86_400_000;
  return Math.round(
    (startOfDay(now).getTime() - startOfDay(value).getTime()) / MS_PER_DAY
  );
}

/**
 * The separator that sits above the first message of a day:
 * `Today` · `Yesterday` · `Monday` (within the last week) · `24/09/2026`.
 */
export function dayLabel(value: string | Date, now: Date = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const elapsed = daysAgo(date, now);

  if (elapsed <= 0) return 'Today';
  if (elapsed === 1) return 'Yesterday';
  // Inside the last week the weekday alone is the most readable form — but
  // only up to 6 days, or "Tuesday" could mean either of two Tuesdays.
  if (elapsed < 7) {
    return date.toLocaleDateString('en-GB', { weekday: 'long' });
  }
  return formatDayMonthYear(date);
}

/**
 * `DD/MM/YYYY`, built by hand rather than left to the runtime's locale.
 *
 * `toLocaleDateString(undefined, …)` renders `17/09/2026` in Lagos and
 * `09/17/2026` on a machine set to US English — and a date like `05/06/2026`
 * is silently a different day depending on who is looking. This is a Nigerian
 * product and these dates are the record of when somebody was told something,
 * so day-first is fixed, not inferred from the browser.
 */
function formatDayMonthYear(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

/**
 * The stamp beside a row in the thread list.
 *
 * Today shows a time, because that is the useful precision for a conversation
 * still in progress; anything older shows the day, because the hour of a
 * message from three weeks ago tells you nothing.
 */
export function listTimestamp(
  value: string | Date | null | undefined,
  now: Date = new Date()
): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  if (daysAgo(date, now) <= 0) {
    // Left to the runtime's locale on purpose: this has to match the bubble
    // timestamps, which Angular's `date: 'shortTime'` pipe renders the same way.
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  return dayLabel(date, now);
}

/** One day's worth of messages, in the order they were sent. */
export interface IMessageDay<T> {
  /** Stable across re-renders for the same day — used as the track key. */
  readonly key: string;
  readonly label: string;
  readonly messages: readonly T[];
}

/**
 * Split a thread into consecutive days.
 *
 * The messages are already in send order, so this is a single pass that starts
 * a new group whenever the local calendar day changes — no sorting, and no
 * assumption that the caller grouped anything.
 */
export function groupMessagesByDay<T extends { createdAt: string }>(
  messages: readonly T[],
  now: Date = new Date()
): IMessageDay<T>[] {
  const days: IMessageDay<T>[] = [];

  for (const message of messages) {
    const date = new Date(message.createdAt);
    const key = Number.isNaN(date.getTime())
      ? 'unknown'
      : startOfDay(date).toISOString();

    const current = days[days.length - 1];
    if (current && current.key === key) {
      (current.messages as T[]).push(message);
      continue;
    }

    days.push({ key, label: dayLabel(date, now), messages: [message] });
  }

  return days;
}
