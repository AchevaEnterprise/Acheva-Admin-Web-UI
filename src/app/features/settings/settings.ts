import {
  ChangeDetectionStrategy,
  Component,
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
import { finalize } from 'rxjs';
import { SEMESTERS, SESSIONS } from '../../core/constants';
import { ISchool, ISchoolSettings } from '../../core/models/admin.model';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { AdminApiService } from '../../core/services/admin-api.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmDialog, IConfirmData } from '../../shared/confirm-dialog';

/**
 * Academic-session control: the school's ACTIVE session/semester + the
 * student self-edit grace window. Staff apps inherit these values, so
 * Course Advisors stop typing sessions freehand.
 */
@Component({
  selector: 'app-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatSelectModule],
  templateUrl: './settings.html',
})
export class Settings implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);

  readonly semesters = SEMESTERS;
  readonly sessions = SESSIONS;

  schools = signal<ISchool[]>([]);
  selectedSchoolId = signal('');
  current = signal<ISchoolSettings | null>(null);
  saving = signal(false);

  form = new FormGroup({
    activeSession: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{4}\/\d{4}$/)],
    }),
    activeSemester: new FormControl<string>(SEMESTERS[0], {
      nonNullable: true,
      validators: [Validators.required],
    }),
    registrationGraceDays: new FormControl(60, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(365)],
    }),
    registrationDeadline: new FormControl('', { nonNullable: true }),
  });

  /** Which gate is currently being saved — so only that button shows busy. */
  settingGate = signal<'AUTO' | 'OPEN' | 'CLOSED' | null>(null);

  /** Manual gate: OPEN/CLOSED override the dates; AUTO follows them. */
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
              ? 'Gate follows the deadline and grace windows.'
              : gate === 'OPEN'
                ? 'Registration gate forced OPEN.'
                : 'Registration gate CLOSED — students cannot edit.',
          );
        },
        error: (err) =>
          this.toast.error(err?.error?.message ?? 'Could not set the gate.'),
      });
  }

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
            activeSession: resp.data.activeSession,
            activeSemester: resp.data.activeSemester,
            registrationGraceDays: resp.data.registrationGraceDays,
            registrationDeadline: resp.data.registrationDeadline
              ? String(resp.data.registrationDeadline).slice(0, 10)
              : '',
          });
        }
      },
    });
  }

  setSemester(semester: string): void {
    this.form.controls.activeSemester.setValue(semester);
  }

  /** Suggested next session, e.g. 2026/2027 → 2027/2028. */
  nextSession(): string {
    const current = this.current()?.activeSession;
    if (!current) return '';
    const [start] = current.split('/').map(Number);
    return `${start + 1}/${start + 2}`;
  }

  rollingOver = signal(false);

  rollover(): void {
    const settings = this.current();
    if (!settings) return;
    const toSession = this.nextSession();
    const data: IConfirmData = {
      title: `Advance to ${toSession}?`,
      message:
        `Every student below their department's final level is promoted one ` +
        `level (100→200→…), Course Advisor cohort mappings are recomputed, ` +
        `and ${toSession} · 1ST SEMESTER becomes the active session. Final-level ` +
        `students are left untouched. This cannot be undone from the UI.`,
      confirmLabel: 'Advance session',
      destructive: true,
    };
    this.dialog
      .open(ConfirmDialog, { data })
      .afterClosed()
      .subscribe((confirmed: boolean) => {
        if (!confirmed) return;
        this.rollingOver.set(true);
        this.api
          .rolloverSession(this.selectedSchoolId(), {
            fromSession: settings.activeSession,
            toSession,
          })
          .pipe(finalize(() => this.rollingOver.set(false)))
          .subscribe({
            next: (resp) => {
              const s = resp.data;
              const moves = Object.entries(s.promotedByLevel)
                .map(([step, count]) => `${step}: ${count}`)
                .join(' · ');
              this.toast.success(
                `Now in ${s.toSession}. Promoted — ${moves || 'none'} · ` +
                  `${s.finalLevelUntouched} final-level untouched · ` +
                  `${s.advisorsRemapped} advisors remapped.`,
              );
              this.load();
            },
            error: (err) =>
              this.toast.error(err?.error?.message ?? 'Rollover failed.'),
          });
      });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Enter a session like 2026/2027.');
      return;
    }
    this.saving.set(true);
    this.api
      .updateSettings(this.selectedSchoolId(), this.form.getRawValue())
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (resp) => {
          this.current.set(resp.data);
          this.toast.success(
            `Active session set: ${resp.data.activeSession} · ${resp.data.activeSemester}`,
          );
        },
        error: (err) =>
          this.toast.error(err?.error?.message ?? 'Could not save settings.'),
      });
  }
}
