import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs';

import {
  IReceiptPage,
  ISchoolFeeReceiptRow,
  SchoolFeeReceiptStatus,
} from '../../core/models/admin.model';
import { formatNaira } from '../../core/naira';
import { AdminApiService } from '../../core/services/admin-api.service';
import { ToastService } from '../../core/services/toast.service';
import { SkeletonTable } from '../../shared/skeleton';

// ─── Reject dialog ────────────────────────────────────────────────────────────

/** Why a receipt is rejected — the student is shown these words. */
@Component({
  selector: 'app-reject-receipt',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <!-- [formGroup] is what makes (ngSubmit) fire; without it the browser
         submits the form natively and reloads the page. -->
    <form class="adm-dialog" [formGroup]="form" (ngSubmit)="save()">
      <h2>Reject receipt · RRR {{ data.rrr }}</h2>
      <p>
        It stops counting toward {{ data.student.fullName }}'s school fees, which
        may hold their course registration again. They are told why, in these words.
      </p>
      <label class="adm-field">
        <span class="adm-field__label">Reason</span>
        <textarea
          class="adm-input rr-reason"
          rows="3"
          maxlength="300"
          placeholder="e.g. The QR code belongs to a different RRR."
          formControlName="reason"
        ></textarea>
      </label>
      <div class="adm-dialog__actions">
        <button type="button" class="adm-btn adm-btn--outline" (click)="ref.close()">Cancel</button>
        <button type="submit" class="adm-btn adm-btn--danger" [disabled]="form.invalid">Reject</button>
      </div>
    </form>
  `,
})
export class RejectReceiptDialog {
  readonly ref = inject(MatDialogRef<RejectReceiptDialog, string>);
  readonly data = inject<ISchoolFeeReceiptRow>(MAT_DIALOG_DATA);
  readonly form = new FormGroup({
    reason: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(5)],
    }),
  });

  save(): void {
    if (this.form.invalid) return;
    this.ref.close(this.form.getRawValue().reason.trim());
  }
}

// ─── The review list ──────────────────────────────────────────────────────────

const TABS: readonly { status: SchoolFeeReceiptStatus | ''; label: string }[] = [
  { status: 'UNCHECKED', label: 'Not yet checked' },
  { status: 'VERIFIED', label: 'Verified' },
  { status: 'REJECTED', label: 'Rejected' },
  { status: '', label: 'All' },
];

/**
 * Receipts students uploaded for school fees paid at the bank or on Remita
 * (2026-11-10). They count from upload; this is where Acheva checks them by
 * hand until the AI check — which will read each Remita receipt's QR code and
 * compare it with the receipt and the figures typed — exists.
 */
@Component({
  selector: 'app-receipts-review',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonTable],
  template: `
    <section class="adm-card rr">
      <header class="sf-card__head sf-card__head--fees">
        <div>
          <h3 class="acva-para-2 fw-500 m-0">Receipts</h3>
          <p class="acva-caption text-neutral-500 m-0">
            Fees paid at the bank or on Remita. Each counts from upload; open both files,
            check the Remita QR code against the RRR and amount, then verify or reject.
          </p>
        </div>
      </header>

      <div class="adm-tabs" role="tablist" aria-label="Receipts by status">
        @for (tab of tabs; track tab.status) {
          <button
            type="button"
            role="tab"
            class="adm-tab"
            [class.adm-tab--on]="status() === tab.status"
            [attr.aria-selected]="status() === tab.status"
            (click)="choose(tab.status)"
          >
            {{ tab.label }}
            @if (tab.status === 'UNCHECKED' && page()) {
              <span class="adm-tab__count">{{ page()!.unchecked }}</span>
            }
          </button>
        }
      </div>

      @if (loading()) {
        <app-skeleton-table [cols]="6" [rows]="4" />
      } @else if ((page()?.data ?? []).length === 0) {
        <p class="adm-empty">No receipts here.</p>
      } @else {
        <div class="rr__wrap">
          <table class="adm-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>RRR</th>
                <th>Amount</th>
                <th>Uploaded</th>
                <th>Files</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              @for (receipt of page()!.data; track receipt._id) {
                <tr>
                  <td>
                    {{ receipt.student.fullName }}
                    <span class="adm-cell-sub">
                      {{ receipt.student.registrationNumber }} · {{ receipt.department ?? '—' }}
                    </span>
                  </td>
                  <td>{{ receipt.rrr }}</td>
                  <td>{{ money(receipt.amount) }}</td>
                  <td>{{ date(receipt.uploadedAt) }}</td>
                  <td>
                    <div class="adm-chip-row">
                      <button type="button" class="adm-link-btn" (click)="open(receipt, 'remitaReceipt')">Remita</button>
                      <button type="button" class="adm-link-btn" (click)="open(receipt, 'schoolFeeReceipt')">School</button>
                    </div>
                  </td>
                  <td>
                    @if (receipt.status === 'UNCHECKED') {
                      <div class="adm-chip-row">
                        <button type="button" class="adm-link-btn" [disabled]="busy()" (click)="verify(receipt)">Verify</button>
                        <button type="button" class="adm-link-btn" [disabled]="busy()" (click)="reject(receipt)">Reject</button>
                      </div>
                    } @else {
                      <span
                        class="adm-chip"
                        [class.adm-chip--tint]="receipt.status === 'VERIFIED'"
                        [class.adm-chip--muted]="receipt.status === 'REJECTED'"
                      >
                        {{ receipt.status === 'VERIFIED' ? 'Verified' : 'Rejected' }}
                      </span>
                      @if (receipt.reason) {
                        <span class="adm-cell-sub">{{ receipt.reason }}</span>
                      }
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  styles: `
    .rr { margin-top: 16px; }
    .rr__wrap { overflow-x: auto; }
    .rr-reason { min-height: 88px; resize: vertical; }
  `,
})
export class ReceiptsReview {
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);

  readonly schoolId = input.required<string>();
  readonly session = input<string | null>(null);

  readonly tabs = TABS;
  readonly status = signal<SchoolFeeReceiptStatus | ''>('UNCHECKED');
  readonly page = signal<IReceiptPage | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);

  constructor() {
    // Reload when the school or session chosen on the page changes.
    effect(() => {
      this.schoolId();
      this.session();
      this.load();
    });
  }

  choose(status: SchoolFeeReceiptStatus | ''): void {
    this.status.set(status);
    this.load();
  }

  private load(): void {
    const schoolId = this.schoolId();
    if (!schoolId) return;
    this.loading.set(true);
    this.api
      .schoolFeeReceipts({
        schoolId,
        session: this.session() ?? undefined,
        status: this.status(),
        limit: 100,
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resp) => this.page.set(resp.data),
        error: (err) => this.toast.error(err?.error?.message ?? 'Could not load the receipts.'),
      });
  }

  /**
   * The tab opens inside the click — one opened after the download is no
   * longer the admin's doing, and popup blockers stop it — and is pointed
   * at the file when it arrives.
   */
  open(receipt: ISchoolFeeReceiptRow, which: 'schoolFeeReceipt' | 'remitaReceipt'): void {
    const tab = window.open('', '_blank');
    this.api.schoolFeeReceiptFile(receipt._id, which).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        if (tab) tab.location.href = url;
        else window.location.assign(url);
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => {
        tab?.close();
        this.toast.error('Could not open the receipt.');
      },
    });
  }

  verify(receipt: ISchoolFeeReceiptRow): void {
    this.decide(receipt, { status: 'VERIFIED' }, `RRR ${receipt.rrr} verified.`);
  }

  reject(receipt: ISchoolFeeReceiptRow): void {
    this.dialog
      .open(RejectReceiptDialog, { data: receipt, width: '560px', maxWidth: '92vw' })
      .afterClosed()
      .subscribe((reason: string | undefined) => {
        if (!reason) return;
        this.decide(
          receipt,
          { status: 'REJECTED', reason },
          `RRR ${receipt.rrr} rejected — ${receipt.student.fullName} has been told why.`,
        );
      });
  }

  private decide(
    receipt: ISchoolFeeReceiptRow,
    body: { status: 'VERIFIED' | 'REJECTED'; reason?: string },
    done: string,
  ): void {
    this.busy.set(true);
    this.api
      .decideSchoolFeeReceipt(receipt._id, body)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.toast.success(done);
          this.load();
        },
        error: (err) => this.toast.error(err?.error?.message ?? 'Could not save that.'),
      });
  }

  money(kobo: number): string {
    return formatNaira(kobo);
  }

  /** "15/01/2027" — day first, fixed for a Nigerian product. */
  date(value: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${date.getFullYear()}`;
  }
}
