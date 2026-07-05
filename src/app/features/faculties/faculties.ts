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
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogRef,
} from '@angular/material/dialog';
import { finalize } from 'rxjs';
import { IFaculty, ISchool } from '../../core/models/admin.model';
import { AdminApiService } from '../../core/services/admin-api.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmDialog, IConfirmData } from '../../shared/confirm-dialog';

// ─── Create/Edit dialog ───────────────────────────────────────────────────────

export interface IFacultyDialogResult {
  name: string;
  code?: string;
}

@Component({
  selector: 'app-faculty-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <form class="adm-dialog" [formGroup]="form" (ngSubmit)="save()">
      <h2>{{ faculty ? 'Edit Faculty' : 'Create Faculty' }}</h2>
      <p>Faculties group departments within an institution</p>
      <label>
        Faculty Name
        <input class="adm-input" formControlName="name" placeholder="e.g School of Physical Sciences" />
      </label>
      <label>
        Code
        <input class="adm-input" formControlName="code" placeholder="e.g SOPS" />
      </label>
      <div class="adm-dialog__actions">
        <button type="button" class="adm-btn adm-btn--outline" (click)="ref.close()">Cancel</button>
        <button type="submit" class="adm-btn" [disabled]="form.invalid">
          {{ faculty ? 'Save Changes' : 'Create Faculty' }}
        </button>
      </div>
    </form>
  `,
})
export class FacultyDialog {
  readonly ref = inject(MatDialogRef<FacultyDialog, IFacultyDialogResult>);
  readonly faculty = inject<IFaculty | null>(MAT_DIALOG_DATA);

  form = new FormGroup({
    name: new FormControl(this.faculty?.name ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3)],
    }),
    code: new FormControl(this.faculty?.code ?? '', { nonNullable: true }),
  });

  save(): void {
    if (this.form.invalid) return;
    const { name, code } = this.form.getRawValue();
    this.ref.close({ name: name.trim(), code: code.trim() || undefined });
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-faculties',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './faculties.html',
})
export class Faculties implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);

  loading = signal(false);
  schools = signal<ISchool[]>([]);
  selectedSchoolId = signal<string>('');
  faculties = signal<IFaculty[]>([]);

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

  onSchoolChange(event: Event): void {
    this.selectedSchoolId.set((event.target as HTMLSelectElement).value);
    this.load();
  }

  load(): void {
    const schoolId = this.selectedSchoolId();
    if (!schoolId) return;
    this.loading.set(true);
    this.api
      .faculties(schoolId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resp) => this.faculties.set(resp.data ?? []),
        error: () => this.toast.error('Could not load faculties.'),
      });
  }

  create(): void {
    if (!this.selectedSchoolId()) return;
    this.dialog
      .open(FacultyDialog, { data: null })
      .afterClosed()
      .subscribe((result: IFacultyDialogResult | undefined) => {
        if (!result) return;
        this.api.createFaculty(this.selectedSchoolId(), result).subscribe({
          next: () => {
            this.toast.success('Faculty created.');
            this.load();
          },
          error: (err) =>
            this.toast.error(err?.error?.message ?? 'Could not create faculty.'),
        });
      });
  }

  edit(faculty: IFaculty): void {
    this.dialog
      .open(FacultyDialog, { data: faculty })
      .afterClosed()
      .subscribe((result: IFacultyDialogResult | undefined) => {
        if (!result) return;
        this.api.updateFaculty(faculty._id, result).subscribe({
          next: () => {
            this.toast.success('Faculty updated.');
            this.load();
          },
          error: (err) =>
            this.toast.error(err?.error?.message ?? 'Could not update faculty.'),
        });
      });
  }

  remove(faculty: IFaculty): void {
    const data: IConfirmData = {
      title: `Delete ${faculty.name}?`,
      message: 'Departments under this faculty are not deleted automatically.',
      confirmLabel: 'Delete faculty',
      destructive: true,
    };
    this.dialog
      .open(ConfirmDialog, { data })
      .afterClosed()
      .subscribe((confirmed: boolean) => {
        if (!confirmed) return;
        this.api.deleteFaculty(faculty._id).subscribe({
          next: () => {
            this.toast.success('Faculty deleted.');
            this.load();
          },
          error: () => this.toast.error('Could not delete faculty.'),
        });
      });
  }
}
