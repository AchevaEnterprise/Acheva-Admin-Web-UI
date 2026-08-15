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
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { finalize } from 'rxjs';
import { ISchool, ISchoolSettings } from '../../core/models/admin.model';
import { AdminApiService } from '../../core/services/admin-api.service';
import { ToastService } from '../../core/services/toast.service';

/**
 * Course registration control.
 *
 * Registration is the STUDENT's act — no Course Advisor initiates it. This
 * page owns the two things that decide when they can do it:
 *
 *  - the **closing date**, which is mandatory for every school. It is the
 *    moment students can no longer register OR change courses, and it is what
 *    triggers the sweep that registers whoever did not;
 *  - the **gate**, the manual override for when the dates are not enough.
 *
 * Split out of Settings deliberately: session rollover is a once-a-year act,
 * while registration windows are adjusted every semester and deserve to be
 * findable on their own.
 */
@Component({
  selector: 'app-registration-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatSelectModule],
  templateUrl: './registration.html',
})
export class RegistrationSettings implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);

  schools = signal<ISchool[]>([]);
  selectedSchoolId = signal('');
  current = signal<ISchoolSettings | null>(null);
  saving = signal(false);
  settingGate = signal<'AUTO' | 'OPEN' | 'CLOSED' | null>(null);

  form = new FormGroup({
    registrationDeadline: new FormControl('', {
      nonNullable: true,
      // Mandatory: a school with no closing date never closes and never
      // sweeps, so its students would sit unregistered indefinitely.
      validators: [Validators.required],
    }),
    registrationGraceDays: new FormControl(60, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(365)],
    }),
  });

  /** The single most important thing on this page. */
  readonly hasDeadline = computed(() => !!this.current()?.registrationDeadline);

  readonly deadlinePassed = computed(() => {
    const deadline = this.current()?.registrationDeadline;
    return !!deadline && new Date(deadline).getTime() < Date.now();
  });

  readonly daysLeft = computed(() => {
    const deadline = this.current()?.registrationDeadline;
    if (!deadline) return null;
    const ms = new Date(deadline).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (24 * 3600 * 1000)));
  });

  /** Plain-language answer to "can students register right now?" */
  readonly windowState = computed<'OPEN' | 'CLOSED' | 'UNCONFIGURED'>(() => {
    const settings = this.current();
    if (!settings?.registrationDeadline) return 'UNCONFIGURED';
    const gate = settings.registrationGate ?? 'AUTO';
    if (gate === 'OPEN') return 'OPEN';
    if (gate === 'CLOSED') return 'CLOSED';
    return this.deadlinePassed() ? 'CLOSED' : 'OPEN';
  });

  ngOnInit(): void {
    this.api.schools().subscribe({
      next: (resp) => {
        this.schools.set(resp.data ?? []);
        const first = resp.data?.[0];
        if (first) {
          this.selectedSchoolId.set(first._id);
          this.load();
        }
      },
    });
  }

  onSchoolChange(schoolId: string): void {
    this.selectedSchoolId.set(schoolId);
    this.load();
  }

  load(): void {
    this.api.settings(this.selectedSchoolId()).subscribe({
      next: (resp) => {
        this.current.set(resp.data);
        if (resp.data) {
          this.form.patchValue({
            registrationDeadline: resp.data.registrationDeadline
              ? String(resp.data.registrationDeadline).slice(0, 10)
              : '',
            registrationGraceDays: resp.data.registrationGraceDays,
          });
        }
      },
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error(
        'A registration closing date is required — students cannot register ' +
          'or be auto-registered without one.',
      );
      return;
    }
    this.saving.set(true);
    this.api
      .updateSettings(this.selectedSchoolId(), this.form.getRawValue())
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (resp) => {
          this.current.set(resp.data);
          this.toast.success('Registration window saved.');
        },
        error: (err) =>
          this.toast.error(
            err?.error?.message ?? 'Could not save the registration window.',
          ),
      });
  }

  setGate(gate: 'AUTO' | 'OPEN' | 'CLOSED'): void {
    this.settingGate.set(gate);
    this.api
      .updateSettings(this.selectedSchoolId(), { registrationGate: gate })
      .pipe(finalize(() => this.settingGate.set(null)))
      .subscribe({
        next: (resp) => {
          this.current.set(resp.data);
          this.toast.success(
            gate === 'AUTO'
              ? 'Gate follows the closing date.'
              : gate === 'OPEN'
                ? 'Registration forced OPEN — the closing date is ignored.'
                : 'Registration CLOSED — students cannot register or edit.',
          );
        },
        error: (err) =>
          this.toast.error(err?.error?.message ?? 'Could not set the gate.'),
      });
  }
}
