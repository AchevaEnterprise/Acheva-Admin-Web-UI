import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Admins are Acheva's own staff: an admin account, and the invite that creates
 * one, must be on an Acheva domain (2026-11-11). A subdomain counts; a
 * lookalike such as `acheva.app.evil.com` does not.
 *
 * Mirrors `acheva-nestjs/src/admin/utils/acheva-email.ts`, which is the rule
 * that actually holds — change both.
 */
export const ACHEVA_EMAIL_DOMAINS = ['acheva.app'] as const;

export function isAchevaEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  const value = email.trim().toLowerCase();
  const at = value.lastIndexOf('@');
  if (at < 1) return false;
  const domain = value.slice(at + 1);
  return ACHEVA_EMAIL_DOMAINS.some(
    (allowed) => domain === allowed || domain.endsWith(`.${allowed}`),
  );
}

/** `{ achevaEmail: true }` for a filled-in address on any other domain. */
export const achevaEmailValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const value = control.value;
  if (typeof value !== 'string' || !value.trim()) return null;
  return isAchevaEmail(value) ? null : { achevaEmail: true };
};
