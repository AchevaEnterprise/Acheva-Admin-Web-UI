/**
 * The last line of defence between stored ciphertext and a reader's screen.
 *
 * Message bodies are encrypted at rest and decrypted by the API, so in a
 * correctly deployed system nothing here ever fires. It exists because the
 * failure it guards against actually happened (2026-09-24): an API running
 * code from before encryption was added served envelopes straight through, and
 * a Head of Department saw `enc.v1.bWI-CggGEx4kYrVI…` where a message should
 * have been.
 *
 * A stale deploy, a rolled-back release, a key removed from the environment —
 * any of them can put an envelope on the wire. None of them is the reader's
 * problem, and none of them should be shown to the reader as if it were
 * content. So every surface that prints a message body or a preview runs it
 * through here first.
 *
 * This is a safety net, NOT a fix: if it ever fires, the API is wrong and the
 * server logs will say so.
 */

/** Matches the envelope written by the backend's `FieldEncryptionService`. */
const CIPHERTEXT = /^enc\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./;

/** Shown in place of anything unreadable. Never blank — blank reads as a bug. */
export const UNREADABLE_MESSAGE = 'Message unavailable';

/**
 * A message body, safe to render.
 *
 * Returns the text unchanged in every normal case. An empty body is left empty
 * — that is a legitimately blank message, not a failure — while an envelope
 * becomes the placeholder.
 */
export function readableText(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  return CIPHERTEXT.test(value) ? UNREADABLE_MESSAGE : value;
}

/**
 * A thread-list preview, safe to render.
 *
 * Same rule, with the empty case spelled out: a thread whose last message
 * cannot be read still needs a line of text, or the row looks broken.
 */
export function readablePreview(
  value: string | null | undefined,
  whenEmpty = 'No messages yet',
): string {
  if (value === null || value === undefined || value === '') return whenEmpty;
  return CIPHERTEXT.test(value) ? UNREADABLE_MESSAGE : value;
}
