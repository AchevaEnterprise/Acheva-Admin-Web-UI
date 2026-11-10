import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Subject, debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import {
  AccountStatusFilter,
  IDirectoryLecturer,
  ILecturerQuery,
  LecturerRole,
} from '../../core/models/admin.model';
import { WIDE_DIALOG } from '../../core/dialog';
import { AdminApiService } from '../../core/services/admin-api.service';
import { ToastService } from '../../core/services/toast.service';
import {
  ROLE_LABELS,
  ROLE_OPTIONS,
  advisorCohort,
  lecturerName,
  officesOf,
} from '../../core/people';
import { ConfirmDialog, IConfirmData } from '../../shared/confirm-dialog';
import { Pager } from '../../shared/pager';
import { IPlacement, PlacementFilter } from '../../shared/placement-filter';
import { SkeletonTable } from '../../shared/skeleton';

const PAGE_SIZE = 20;

// ─── Detail dialog ──────────────────────────────────────────────────────────

@Component({
  selector: 'app-lecturer-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    <div class="adm-dialog adm-dialog--wide">
      <h2>{{ name }}</h2>
      <p>{{ lecturer.email }}</p>

      <div class="adm-chip-row mt-2">
        @for (role of offices; track role) {
          <span class="adm-chip" [class.adm-chip--brand]="$first" [class.adm-chip--tint]="!$first">
            {{ roleLabels[role] }}
          </span>
        }
      </div>

      <h3 class="adm-section-title">Where they sit</h3>
      <dl class="adm-dl">
        <dt>School</dt>
        <dd>{{ lecturer.school?.name ?? '—' }}</dd>
        <dt>Faculty</dt>
        <dd>{{ lecturer.faculty?.name ?? '—' }}</dd>
        <dt>Department</dt>
        <dd>{{ lecturer.department?.name ?? '—' }}</dd>
        @if (cohort) {
          <dt>Advises</dt>
          <dd>{{ cohort }}</dd>
        }
      </dl>

      <h3 class="adm-section-title">Account</h3>
      <dl class="adm-dl">
        <dt>Status</dt>
        <dd>{{ active() ? 'Active' : 'Deactivated' }}</dd>
        <dt>Email</dt>
        <dd>{{ lecturer.emailVerified ? 'Verified' : 'Not verified yet' }}</dd>
        <dt>Joined</dt>
        <dd>{{ lecturer.createdAt ? (lecturer.createdAt | date: 'dd/MM/yyyy') : '—' }}</dd>
      </dl>

      <div class="adm-dialog__actions">
        <button
          type="button"
          class="adm-btn adm-btn--outline"
          [class.adm-btn--danger]="active()"
          [disabled]="saving()"
          (click)="toggleActive()"
        >
          {{ active() ? 'Deactivate account' : 'Reactivate account' }}
        </button>
        <button type="button" class="adm-btn" (click)="ref.close(changed)">Done</button>
      </div>
    </div>
  `,
})
export class LecturerDialog {
  readonly ref = inject(MatDialogRef<LecturerDialog, boolean>);
  readonly lecturer = inject<IDirectoryLecturer>(MAT_DIALOG_DATA);
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);

  readonly roleLabels = ROLE_LABELS;
  readonly name = lecturerName(this.lecturer);
  readonly offices = officesOf(this.lecturer);
  readonly cohort = advisorCohort(this.lecturer);
  readonly active = signal(this.lecturer.isActive !== false);
  readonly saving = signal(false);
  changed = false;

  toggleActive(): void {
    const deactivating = this.active();
    const data: IConfirmData = deactivating
      ? {
          title: `Deactivate ${this.name}?`,
          message:
            'They are signed out on their next action and cannot sign in again until reactivated. ' +
            'Nothing they have done is deleted.',
          confirmLabel: 'Deactivate',
          destructive: true,
        }
      : {
          title: `Reactivate ${this.name}?`,
          message: 'They will be able to sign in again.',
          confirmLabel: 'Reactivate',
        };
    this.dialog
      .open(ConfirmDialog, { data })
      .afterClosed()
      .subscribe((confirmed: boolean) => {
        if (!confirmed) return;
        this.saving.set(true);
        this.api
          .setLecturerActive(this.lecturer._id, !deactivating)
          .pipe(finalize(() => this.saving.set(false)))
          .subscribe({
            next: () => {
              this.active.set(!deactivating);
              this.changed = true;
              this.toast.success(deactivating ? 'Account deactivated.' : 'Account reactivated.');
            },
            error: (err) =>
              this.toast.error(err?.error?.message ?? 'Could not change the account.'),
          });
      });
  }
}

// ─── Page ───────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-lecturers',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, PlacementFilter, Pager, SkeletonTable],
  templateUrl: './lecturers.html',
})
export class Lecturers implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly roleLabels = ROLE_LABELS;
  readonly roleOptions = ROLE_OPTIONS;
  readonly name = lecturerName;
  readonly offices = officesOf;

  readonly rows = signal<IDirectoryLecturer[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly query = signal<ILecturerQuery>({ page: 1, limit: PAGE_SIZE });

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

  onRole(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as LecturerRole | '';
    this.patch({ role: value || undefined });
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

  open(lecturer: IDirectoryLecturer): void {
    this.dialog
      .open(LecturerDialog, { ...WIDE_DIALOG, data: lecturer })
      .afterClosed()
      .subscribe((changed: boolean) => {
        if (changed) this.load();
      });
  }

  /** Any filter change starts again from the first page. */
  private patch(change: Partial<ILecturerQuery>): void {
    this.query.update((query) => ({ ...query, ...change, page: 1 }));
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api
      .lecturers(this.query())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resp) => {
          this.rows.set(resp.data?.data ?? []);
          this.total.set(resp.data?.total ?? 0);
        },
        error: (err) => this.toast.error(err?.error?.message ?? 'Could not load lecturers.'),
      });
  }
}
