import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { finalize } from 'rxjs';

import { WIDE_DIALOG } from '../../core/dialog';
import {
  IBank,
  ISchool,
  ISchoolFeeAccount,
  ISchoolFeeDepartment,
  ISchoolFeePlanView,
} from '../../core/models/admin.model';
import { formatNaira, toKobo, toNaira } from '../../core/naira';
import { caretAfterFormat, formatNairaInput, nairaInWords } from '../../core/money-input';
import { AdminApiService } from '../../core/services/admin-api.service';
import { ToastService } from '../../core/services/toast.service';
import { Skeleton } from '../../shared/skeleton';
import { ReceiptsReview } from './receipts-review';

/** A fee's place in the grid: department × level × option ('' = every option). */
const feeKey = (department: string, level: string, option: string | null): string =>
  `${department}|${level}|${option ?? ''}`;

// ─── Payout account dialog ────────────────────────────────────────────────────

export interface IAccountDialogData {
  readonly schoolId: string;
  readonly schoolName: string;
  readonly account: ISchoolFeeAccount | null;
}

/**
 * The university's one payout account. Paystack confirms the holder's name;
 * the account becomes a subaccount every school-fee payment is routed to.
 */
@Component({
  selector: 'app-school-fee-account',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatSelectModule],
  template: `
    <form class="adm-dialog" [formGroup]="form" (ngSubmit)="save()">
      <h2>Payout account · {{ data.schoolName }}</h2>
      <p>
        Every school-fee payment settles here, through Paystack. Acheva takes
        nothing from it; Paystack’s processing charge comes out of each payment.
      </p>
      <label class="adm-field">
        <span class="adm-field__label">Bank</span>
        <mat-form-field appearance="outline" class="adm-mat">
          <mat-select formControlName="bankCode" placeholder="Choose the bank" aria-label="Bank">
            @for (bank of banks(); track bank.bankCode) {
              <mat-option [value]="bank.bankCode">{{ bank.bankName }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </label>
      <label class="adm-field">
        <span class="adm-field__label">Account number</span>
        <input class="adm-input" formControlName="accountNumber" inputmode="numeric" maxlength="10" placeholder="10 digits" />
      </label>
      <p class="acva-caption text-neutral-500 m-0">
        Paystack confirms the account holder’s name — it is shown as the bank has it, not as typed.
      </p>
      <div class="adm-dialog__actions">
        <button type="button" class="adm-btn adm-btn--outline" (click)="ref.close()">Cancel</button>
        <button type="submit" class="adm-btn" [disabled]="form.invalid || saving()">
          {{ saving() ? 'Confirming with Paystack…' : 'Save account' }}
        </button>
      </div>
    </form>
  `,
})
export class SchoolFeeAccountDialog implements OnInit {
  readonly ref = inject(MatDialogRef<SchoolFeeAccountDialog, ISchoolFeeAccount>);
  readonly data = inject<IAccountDialogData>(MAT_DIALOG_DATA);
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);

  readonly banks = signal<IBank[]>([]);
  readonly saving = signal(false);

  readonly form = new FormGroup({
    bankCode: new FormControl(this.data.account?.bankCode ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    accountNumber: new FormControl(this.data.account?.accountNumber ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{10}$/)],
    }),
  });

  ngOnInit(): void {
    this.api.banks().subscribe({
      next: (resp) => this.banks.set(resp.data ?? []),
      error: () => this.toast.error('Could not load the list of banks.'),
    });
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.api
      .setSchoolFeeAccount({ schoolId: this.data.schoolId, ...this.form.getRawValue() })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (resp) => {
          this.toast.success(`Saved — ${resp.data.accountName}.`);
          this.ref.close(resp.data);
        },
        error: (err) => this.toast.error(err?.error?.message ?? 'Could not save the account.'),
      });
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * School fees (2026-11-09) — Acheva sets them, per session.
 *
 * One amount per department × level, and per option where a department's
 * options are charged differently (an option left blank pays the department
 * fee). The due dates are common to the whole plan; students choose each
 * amount on the 30% rule. Nothing is payable until the plan is published,
 * and publishing needs the payout account confirmed by Paystack.
 */
@Component({
  selector: 'app-school-fees',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatFormFieldModule, MatSelectModule, Skeleton, ReceiptsReview],
  templateUrl: './school-fees.html',
})
export class SchoolFees implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly schools = signal<ISchool[]>([]);
  readonly schoolId = signal('');
  readonly view = signal<ISchoolFeePlanView | null>(null);

  /** The editable plan: due dates and the amounts typed, in naira. */
  readonly dueDates = signal<string[]>(['', '']);
  readonly amounts = signal<Record<string, string>>({});
  readonly dirty = signal(false);
  readonly search = signal('');

  readonly status = computed(() => {
    const plan = this.view()?.plan;
    if (!plan) return { label: 'Not set up', tone: 'muted' };
    if (plan.collectionStartedAt) return { label: 'Taking payments', tone: 'brand' };
    if (plan.status === 'PUBLISHED') return { label: 'Published', tone: 'brand' };
    return { label: 'Draft', tone: 'tint' };
  });

  /** Fees that have taken money: shown, never edited. */
  readonly locked = computed(() => {
    const keys = new Set<string>();
    for (const fee of this.view()?.fees ?? []) {
      if (fee.collectionStartedAt) keys.add(feeKey(fee.department, fee.level, fee.option));
    }
    return keys;
  });

  readonly countLocked = computed(() => !!this.view()?.plan?.collectionStartedAt);

  readonly departments = computed(() => {
    const term = this.search().trim().toLowerCase();
    return (this.view()?.departments ?? []).filter(
      (department) =>
        !term ||
        department.name.toLowerCase().includes(term) ||
        (department.code ?? '').toLowerCase().includes(term) ||
        (department.faculty ?? '').toLowerCase().includes(term),
    );
  });

  /** How many of a department's levels have a fee — the section's summary. */
  setLevels(department: ISchoolFeeDepartment): number {
    const amounts = this.amounts();
    return department.levels.filter((level) => toKobo(amounts[feeKey(department._id, level, null)]) > 0).length;
  }

  readonly feeCount = computed(() => Object.values(this.amounts()).filter((value) => toKobo(value) > 0).length);

  readonly publishBlocker = computed((): string | null => {
    const view = this.view();
    if (!view?.plan) return 'Save the plan first.';
    if (this.dirty()) return 'Save your changes first.';
    if (!view.account?.verified) return 'Add the payout account first.';
    if ((view.fees ?? []).length === 0) return 'Set at least one fee.';
    return null;
  });

  ngOnInit(): void {
    this.api.schools().subscribe({
      next: (resp) => {
        this.schools.set(resp.data ?? []);
        const first = resp.data?.[0];
        if (first) {
          this.schoolId.set(first._id);
          this.load();
        } else {
          this.loading.set(false);
        }
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Could not load the schools.');
      },
    });
  }

  chooseSchool(schoolId: string): void {
    this.schoolId.set(schoolId);
    this.load();
  }

  chooseSession(session: string): void {
    this.load(session);
  }

  private load(session?: string): void {
    this.loading.set(true);
    this.api
      .schoolFeePlan(this.schoolId(), session)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resp) => this.adopt(resp.data),
        error: (err) => {
          this.view.set(null);
          this.toast.error(err?.error?.message ?? 'Could not load school fees.');
        },
      });
  }

  /** Take the server's view as the new starting point for editing. */
  private adopt(view: ISchoolFeePlanView): void {
    this.view.set(view);
    const dates = (view.plan?.instalments ?? []).map((row) => String(row.dueDate).slice(0, 10));
    this.dueDates.set(dates.length ? dates : ['', '']);
    const amounts: Record<string, string> = {};
    for (const fee of view.fees) {
      amounts[feeKey(fee.department, fee.level, fee.option)] = formatNairaInput(String(toNaira(fee.amountKobo)));
    }
    this.amounts.set(amounts);
    this.dirty.set(false);
  }

  setCount(count: number): void {
    if (this.countLocked()) return;
    this.dueDates.update((dates) => Array.from({ length: count }, (_, index) => dates[index] ?? ''));
    this.dirty.set(true);
  }

  setDueDate(index: number, value: string): void {
    this.dueDates.update((dates) => dates.map((date, position) => (position === index ? value : date)));
    this.dirty.set(true);
  }

  amountFor(department: string, level: string, option: string | null): string {
    return this.amounts()[feeKey(department, level, option)] ?? '';
  }

  isLocked(department: string, level: string, option: string | null): boolean {
    return this.locked().has(feeKey(department, level, option));
  }

  setAmount(department: string, level: string, option: string | null, value: string): void {
    this.amounts.update((amounts) => ({ ...amounts, [feeKey(department, level, option)]: value }));
    this.dirty.set(true);
  }

  /**
   * Commas as the fee is typed (2026-11-11), with the caret kept after the
   * digit it followed. `toKobo` ignores the commas, so nothing downstream
   * changes.
   */
  onAmountInput(event: Event, department: string, level: string, option: string | null): void {
    const input = event.target as HTMLInputElement;
    const caret = input.selectionStart ?? input.value.length;
    const formatted = formatNairaInput(input.value);
    if (formatted !== input.value) {
      const next = caretAfterFormat(input.value, caret, formatted);
      input.value = formatted;
      input.setSelectionRange(next, next);
    }
    this.setAmount(department, level, option, formatted);
  }

  /** The amount read back in words beneath its box — empty while blank. */
  wordsFor(department: string, level: string, option: string | null): string {
    return nairaInWords(toKobo(this.amountFor(department, level, option)));
  }

  /** Copy a department's 100-level fee to every level still blank. */
  fillLevels(department: ISchoolFeeDepartment): void {
    const first = this.amountFor(department._id, department.levels[0], null);
    if (toKobo(first) <= 0) return;
    this.amounts.update((amounts) => {
      const next = { ...amounts };
      for (const level of department.levels) {
        const key = feeKey(department._id, level, null);
        if (!next[key] || toKobo(next[key]) <= 0) next[key] = first;
      }
      return next;
    });
    this.dirty.set(true);
  }

  save(): void {
    const view = this.view();
    if (!view) return;
    const dates = this.dueDates();
    if (dates.some((date) => !date)) {
      this.toast.error('Give every payment a due date.');
      return;
    }
    const fees = Object.entries(this.amounts())
      .map(([key, value]) => {
        const [department, level, option] = key.split('|');
        return { department, level, option: option || null, amountKobo: toKobo(value) };
      })
      .filter((fee) => fee.amountKobo > 0);

    this.saving.set(true);
    this.api
      .saveSchoolFeePlan({
        schoolId: this.schoolId(),
        session: view.session,
        instalments: dates.map((dueDate) => ({ dueDate })),
        fees,
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (resp) => {
          this.adopt(resp.data);
          this.toast.success(`Saved ${resp.data.fees.length} fees for ${resp.data.session}.`);
        },
        error: (err) => this.toast.error(err?.error?.message ?? 'Could not save the plan.'),
      });
  }

  publish(): void {
    const view = this.view();
    if (!view || this.publishBlocker()) return;
    this.saving.set(true);
    this.api
      .publishSchoolFeePlan(this.schoolId(), view.session)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (resp) => {
          this.adopt(resp.data);
          this.toast.success(`${resp.data.session} school fees are open for payment.`);
        },
        error: (err) => this.toast.error(err?.error?.message ?? 'Could not publish the plan.'),
      });
  }

  unpublish(): void {
    const view = this.view();
    if (!view) return;
    this.saving.set(true);
    this.api
      .unpublishSchoolFeePlan(this.schoolId(), view.session)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (resp) => {
          this.adopt(resp.data);
          this.toast.success('Withdrawn — students can no longer pay these fees.');
        },
        error: (err) => this.toast.error(err?.error?.message ?? 'Could not withdraw the plan.'),
      });
  }

  editAccount(): void {
    const view = this.view();
    if (!view) return;
    this.dialog
      .open(SchoolFeeAccountDialog, {
        ...WIDE_DIALOG,
        data: { schoolId: this.schoolId(), schoolName: view.school.name, account: view.account },
      })
      .afterClosed()
      .subscribe((account: ISchoolFeeAccount | undefined) => {
        if (account) this.view.update((current) => (current ? { ...current, account } : current));
      });
  }

  money(kobo: number): string {
    return formatNaira(kobo);
  }

  /** "15/01/2027" — day first, fixed for a Nigerian product. */
  date(value: string | null): string {
    if (!value) return '';
    const [year, month, day] = String(value).slice(0, 10).split('-');
    return `${day}/${month}/${year}`;
  }
}
