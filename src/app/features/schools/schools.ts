import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { finalize } from 'rxjs';
import { AdminApiService } from '../../core/services/admin-api.service';
import { ToastService } from '../../core/services/toast.service';
import { ISchool } from '../../core/models/admin.model';
import { ConfirmDialog, IConfirmData } from '../../shared/confirm-dialog';
import { ISchoolDialogResult, SchoolDialog } from './school-dialog';

/** School Management — table with counts, create/edit/toggle/delete. */
@Component({
  selector: 'app-schools',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './schools.html',
})
export class Schools implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);

  loading = signal(false);
  schools = signal<ISchool[]>([]);
  searchTerm = signal('');

  readonly filtered = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.schools();
    return this.schools().filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        (s.acronym ?? '').toLowerCase().includes(term),
    );
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api
      .schoolsWithCounts()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resp) => this.schools.set(resp.data ?? []),
        error: () => this.toast.error('Could not load schools.'),
      });
  }

  onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  create(): void {
    this.dialog
      .open(SchoolDialog, { data: null })
      .afterClosed()
      .subscribe((result: ISchoolDialogResult | undefined) => {
        if (!result) return;
        this.api.createSchool(result).subscribe({
          next: () => {
            this.toast.success('School created.');
            this.load();
          },
          error: (err) =>
            this.toast.error(err?.error?.message ?? 'Could not create school.'),
        });
      });
  }

  edit(school: ISchool): void {
    this.dialog
      .open(SchoolDialog, { data: school })
      .afterClosed()
      .subscribe((result: ISchoolDialogResult | undefined) => {
        if (!result) return;
        this.api.updateSchool(school._id, result).subscribe({
          next: () => {
            this.toast.success('School updated.');
            this.load();
          },
          error: (err) =>
            this.toast.error(err?.error?.message ?? 'Could not update school.'),
        });
      });
  }

  toggle(school: ISchool): void {
    const next = !(school.isActive ?? true);
    this.api.updateSchool(school._id, { isActive: next }).subscribe({
      next: () => {
        this.toast.success(next ? 'School enabled.' : 'School disabled.');
        this.load();
      },
      error: () => this.toast.error('Could not update school status.'),
    });
  }

  remove(school: ISchool): void {
    const data: IConfirmData = {
      title: `Delete ${school.acronym || school.name}?`,
      message:
        'This removes the institution from the platform. Faculties, departments and accounts under it are not deleted automatically — this is a dev-only action for now.',
      confirmLabel: 'Delete school',
      destructive: true,
    };
    this.dialog
      .open(ConfirmDialog, { data })
      .afterClosed()
      .subscribe((confirmed: boolean) => {
        if (!confirmed) return;
        this.api.deleteSchool(school._id).subscribe({
          next: () => {
            this.toast.success('School deleted.');
            this.load();
          },
          error: () => this.toast.error('Could not delete school.'),
        });
      });
  }
}
