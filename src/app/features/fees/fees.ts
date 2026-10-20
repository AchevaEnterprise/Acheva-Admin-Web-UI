import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs';

import { formatNaira, toKobo, toNaira } from '../../core/naira';
import { IPlatformSettings } from '../../core/models/admin.model';
import { PlatformSettingsService } from '../../core/services/platform-settings.service';
import { ToastService } from '../../core/services/toast.service';

/**
 * Acheva's commercial terms — the figures WE set, in one place.
 *
 * ## What is NOT on this page
 *
 * The departmental dues amount. A **Head of Department** sets what their
 * department charges, in the staff portal; what lives here is only Acheva's
 * cut of each payment. Conflating the two would put a university's pricing in
 * our console, which is neither our decision nor our liability — and the
 * labels say so, because "dues fee" read on its own is genuinely ambiguous.
 *
 * ## The split is shown, not just configured
 *
 * Typing "15%" and trusting it is how a rounding error ships. Both fields
 * render a live worked example in naira — the same figures the server will
 * compute — so whoever sets the price sees what a department actually
 * receives before saving.
 */
@Component({
  selector: 'app-fees',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './fees.html',
})
export class Fees implements OnInit {
  private readonly api = inject(PlatformSettingsService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly current = signal<IPlatformSettings | null>(null);

  /** Mirrors of the form, so the worked examples recompute as you type. */
  readonly transcriptFee = signal(0);
  readonly departmentPercent = signal(0);
  readonly duesFee = signal(0);

  readonly form = new FormGroup({
    transcriptFeeNaira: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    transcriptDepartmentSharePercent: new FormControl(15, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(100)],
    }),
    duesPlatformFeeNaira: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
  });

  // ── Worked examples, in kobo, matching the server's rounding exactly ─────

  /**
   * The department's share is FLOORED and Acheva takes the remainder — the
   * same rule as `splitTranscriptFee` on the server. Rounding both halves
   * independently is how a split ends up a kobo over what was collected.
   */
  readonly transcriptSplit = computed(() => {
    const total = toKobo(this.transcriptFee());
    const percent = Math.round(this.departmentPercent());
    const department = Math.floor((total * percent) / 100);
    return { total, department, platform: total - department };
  });

  readonly transcriptFeeIsZero = computed(
    () => this.transcriptSplit().total === 0,
  );

  /** A worked dues example at a representative ₦37,500 charge. */
  readonly duesExample = computed(() => {
    const charge = 3_750_000;
    const platform = toKobo(this.duesFee());
    return {
      charge,
      platform,
      department: charge - platform,
      /** A fee at or above the charge leaves the department nothing. */
      swallowsCharge: platform >= charge,
    };
  });

  readonly canSave = computed(
    () => !this.saving() && !this.duesExample().swallowsCharge,
  );

  ngOnInit(): void {
    this.form.valueChanges.subscribe((value) => {
      this.transcriptFee.set(Number(value.transcriptFeeNaira) || 0);
      this.departmentPercent.set(
        Number(value.transcriptDepartmentSharePercent) || 0,
      );
      this.duesFee.set(Number(value.duesPlatformFeeNaira) || 0);
    });

    this.load();
  }

  private load(): void {
    this.api
      .current()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resp) => {
          const settings = resp.data;
          this.current.set(settings);
          this.form.patchValue({
            transcriptFeeNaira: toNaira(settings.transcriptFeeKobo),
            transcriptDepartmentSharePercent:
              settings.transcriptDepartmentSharePercent,
            duesPlatformFeeNaira: toNaira(settings.duesPlatformFeeKobo),
          });
        },
        error: () => this.toast.error('Could not load the fee settings.'),
      });
  }

  save(): void {
    if (this.form.invalid || !this.canSave()) return;
    this.saving.set(true);

    const raw = this.form.getRawValue();
    this.api
      .update({
        transcriptFeeKobo: toKobo(raw.transcriptFeeNaira),
        transcriptDepartmentSharePercent: Math.round(
          raw.transcriptDepartmentSharePercent,
        ),
        duesPlatformFeeKobo: toKobo(raw.duesPlatformFeeNaira),
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (resp) => {
          this.current.set(resp.data);
          this.toast.success('Fees updated. New payments use these figures.');
        },
        error: (err) =>
          this.toast.error(
            err?.error?.message ?? 'Could not save the fee settings.',
          ),
      });
  }

  money(kobo: number): string {
    return formatNaira(kobo);
  }
}
