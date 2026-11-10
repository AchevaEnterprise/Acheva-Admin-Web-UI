import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Subject, debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { LEVELS } from '../../core/constants';
import {
  AccountStatusFilter,
  IDirectoryStudent,
  IStudentQuery,
} from '../../core/models/admin.model';
import { WIDE_DIALOG } from '../../core/dialog';
import { AdminApiService } from '../../core/services/admin-api.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmDialog, IConfirmData } from '../../shared/confirm-dialog';
import { Pager } from '../../shared/pager';
import { IPlacement, PlacementFilter } from '../../shared/placement-filter';
import { SkeletonTable } from '../../shared/skeleton';

const PAGE_SIZE = 20;

/** What each required detail is called on screen. */
const DETAIL_LABELS: Readonly<Record<string, string>> = {
  sex: 'Sex',
  dateOfBirth: 'Date of birth',
  nationality: 'Nationality',
  stateOfOrigin: 'State of origin',
  modeOfEntry: 'Mode of entry',
};

const MODE_OF_ENTRY_LABELS: Readonly<Record<string, string>> = {
  UME: 'UME',
  UTME: 'UTME',
  DIRECT_ENTRY: 'Direct Entry',
  TRANSFER: 'Transfer',
  INTER_UNIVERSITY: 'Inter-university transfer',
  PRE_DEGREE: 'Pre-degree',
};

/**
 * "300", "Extra Year 2", "Awaiting final results" or "Graduated" — never the
 * raw EXCEPTION level.
 */
export function studentStanding(student: IDirectoryStudent): string {
  if (student.academicStanding === 'GRADUATED') return 'Graduated';
  if (student.academicStanding === 'AWAITING_RESULTS') return 'Awaiting final results';
  if (student.academicStanding === 'EXTRA_YEAR' || student.level === 'EXCEPTION') {
    return `Extra Year ${Math.max(student.extraYear ?? 0, 1)}`;
  }
  return student.level;
}

/**
 * A calendar date stored at UTC midnight, as DD/MM/YYYY from its own day —
 * formatting it in local time would show the day before west of Greenwich.
 */
function dayFirst(value: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '—';
}

// ─── Detail dialog ──────────────────────────────────────────────────────────

@Component({
  selector: 'app-student-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, ReactiveFormsModule, TitleCasePipe],
  template: `
    <div class="adm-dialog adm-dialog--wide">
      <h2>{{ student.fullName | titlecase }}</h2>
      <p>{{ regNo() }} · {{ student.email || 'No email on record' }}</p>

      <h3 class="adm-section-title">Where they are</h3>
      <dl class="adm-dl">
        <dt>School</dt>
        <dd>{{ student.school?.name ?? '—' }}</dd>
        <dt>Faculty</dt>
        <dd>{{ student.faculty?.name ?? '—' }}</dd>
        <dt>Department</dt>
        <dd>{{ student.department?.name ?? '—' }}</dd>
        <dt>Level</dt>
        <dd>
          {{ standing }}
          @if (student.graduatedSession) {
            <span class="adm-cell-sub">Graduated in {{ student.graduatedSession }}</span>
          }
        </dd>
        <dt>Intake</dt>
        <dd>
          {{ student.admissionYear ?? '—' }}
          @if (student.originalAdmissionYear) {
            <span class="adm-cell-sub">Admitted {{ student.originalAdmissionYear }}</span>
          }
        </dd>
      </dl>

      <h3 class="adm-section-title">Personal details</h3>
      @if (student.missingDetails.length) {
        <p class="m-0 mb-2" style="font-size: 0.8125rem; color: #2793ff">
          Not given yet: {{ missingLabels }}. They will be asked when they next sign in.
        </p>
      }
      <dl class="adm-dl">
        <dt>Sex</dt>
        <dd>{{ sex }}</dd>
        <dt>Date of birth</dt>
        <dd>{{ dateOfBirth }}</dd>
        <dt>Nationality</dt>
        <dd>{{ student.nationality || '—' }}</dd>
        <dt>State of origin</dt>
        <dd>{{ student.stateOfOrigin || '—' }}</dd>
        <dt>Mode of entry</dt>
        <dd>{{ modeOfEntry }}</dd>
        <dt>Option</dt>
        <dd>{{ student.programmeOption || 'None' }}</dd>
      </dl>

      @if (student.transferredFrom?.length) {
        <h3 class="adm-section-title">Transferred from</h3>
        <dl class="adm-dl">
          @for (leg of student.transferredFrom; track leg.transferredAt) {
            <dt>{{ leg.transferredAt | date: 'dd/MM/yyyy' }}</dt>
            <dd>
              {{ leg.department?.name ?? 'A department' }}, {{ leg.level }} level
              @if (leg.session) {
                <span class="adm-cell-sub">Left after {{ leg.session }}</span>
              }
            </dd>
          }
        </dl>
      }

      <h3 class="adm-section-title">Account</h3>
      <dl class="adm-dl">
        <dt>Status</dt>
        <dd>
          {{ student.isActive === false ? 'Deactivated' : 'Active' }}
          @if (student.isActive === false && student.deactivatedAt) {
            <span class="adm-cell-sub">Since {{ student.deactivatedAt | date: 'dd/MM/yyyy' }}</span>
          }
        </dd>
        <dt>Email</dt>
        <dd>{{ student.emailVerified ? 'Verified' : 'Not verified yet' }}</dd>
      </dl>

      @if (correcting()) {
        <h3 class="adm-section-title">Correct the registration number</h3>
        <p class="m-0" style="font-size: 0.8125rem; color: #6b7280">
          Changes the student and every result entry that carries the number, in one step.
        </p>
        <label>
          New registration number
          <input class="adm-input" [formControl]="newRegNo" autocomplete="off" />
        </label>
      }

      <div class="adm-dialog__actions">
        @if (correcting()) {
          <button type="button" class="adm-btn adm-btn--outline" (click)="correcting.set(false)">
            Cancel
          </button>
          <button
            type="button"
            class="adm-btn"
            [disabled]="newRegNo.invalid || saving()"
            (click)="saveRegNo()"
          >
            {{ saving() ? 'Saving…' : 'Save number' }}
          </button>
        } @else {
          <button type="button" class="adm-btn adm-btn--outline" (click)="correcting.set(true)">
            Correct registration number
          </button>
          <button type="button" class="adm-btn" (click)="ref.close(changed)">Done</button>
        }
      </div>
    </div>
  `,
})
export class StudentDialog {
  readonly ref = inject(MatDialogRef<StudentDialog, boolean>);
  readonly student = inject<IDirectoryStudent>(MAT_DIALOG_DATA);
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);

  readonly regNo = signal(this.student.registrationNumber);
  readonly standing = studentStanding(this.student);
  readonly correcting = signal(false);
  readonly saving = signal(false);
  changed = false;

  readonly newRegNo = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(40)],
  });

  readonly sex =
    this.student.sex === 'MALE' ? 'Male' : this.student.sex === 'FEMALE' ? 'Female' : '—';
  readonly dateOfBirth = dayFirst(this.student.dateOfBirth);
  readonly modeOfEntry = this.student.modeOfEntry
    ? (MODE_OF_ENTRY_LABELS[this.student.modeOfEntry] ?? this.student.modeOfEntry)
    : '—';
  readonly missingLabels = this.student.missingDetails
    .map((field) => DETAIL_LABELS[field] ?? field)
    .join(', ');

  saveRegNo(): void {
    const next = this.newRegNo.value.trim();
    if (!next) return;
    const data: IConfirmData = {
      title: 'Change the registration number?',
      message: `${this.regNo()} becomes ${next} on the student and on every result that lists them.`,
      confirmLabel: 'Change it',
    };
    this.dialog
      .open(ConfirmDialog, { data })
      .afterClosed()
      .subscribe((confirmed: boolean) => {
        if (!confirmed) return;
        this.saving.set(true);
        this.api
          .changeRegNo(this.student._id, next)
          .pipe(finalize(() => this.saving.set(false)))
          .subscribe({
            next: (resp) => {
              this.regNo.set(resp.data.newRegNo);
              this.correcting.set(false);
              this.newRegNo.reset();
              this.changed = true;
              const entries = resp.data.entriesUpdated;
              this.toast.success(
                `Registration number changed. ${entries} result ${entries === 1 ? 'entry' : 'entries'} updated.`,
              );
            },
            error: (err) =>
              this.toast.error(err?.error?.message ?? 'Could not change the number.'),
          });
      });
  }
}

// ─── Page ───────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-students',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlacementFilter, Pager, SkeletonTable, TitleCasePipe],
  templateUrl: './students.html',
})
export class Students implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly levels = LEVELS;
  readonly standing = studentStanding;
  readonly rows = signal<IDirectoryStudent[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly query = signal<IStudentQuery>({ page: 1, limit: PAGE_SIZE });

  private readonly search$ = new Subject<string>();

  ngOnInit(): void {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((search) => this.patch({ search: search.trim() || undefined }));
    this.load();
  }

  onPlacement(placement: IPlacement): void {
    this.patch({ ...placement });
  }

  onLevel(event: Event): void {
    this.patch({ level: (event.target as HTMLSelectElement).value || undefined });
  }

  onDetails(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as 'COMPLETE' | 'MISSING' | '';
    this.patch({ details: value || undefined });
  }

  onStatus(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as AccountStatusFilter | '';
    this.patch({ status: value || undefined });
  }

  onSearch(event: Event): void {
    this.search$.next((event.target as HTMLInputElement).value);
  }

  goTo(page: number): void {
    this.query.update((query) => ({ ...query, page }));
    this.load();
  }

  open(student: IDirectoryStudent): void {
    this.dialog
      .open(StudentDialog, { ...WIDE_DIALOG, data: student })
      .afterClosed()
      .subscribe((changed: boolean) => {
        if (changed) this.load();
      });
  }

  private patch(change: Partial<IStudentQuery>): void {
    this.query.update((query) => ({ ...query, ...change, page: 1 }));
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api
      .students(this.query())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resp) => {
          this.rows.set(resp.data?.data ?? []);
          this.total.set(resp.data?.total ?? 0);
        },
        error: (err) => this.toast.error(err?.error?.message ?? 'Could not load students.'),
      });
  }
}
