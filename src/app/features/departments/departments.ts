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
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { finalize } from 'rxjs';
import { IDepartment, IFaculty, ISchool } from '../../core/models/admin.model';
import { AdminApiService } from '../../core/services/admin-api.service';
import { ToastService } from '../../core/services/toast.service';

// ─── Create/Edit dialog ───────────────────────────────────────────────────────

export interface IDepartmentDialogResult {
  name: string;
  code?: string;
}

@Component({
  selector: 'app-department-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <form class="adm-dialog" [formGroup]="form" (ngSubmit)="save()">
      <h2>{{ department ? 'Edit Department' : 'Create Department' }}</h2>
      <p>Departments own courses and student cohorts</p>
      <label>
        Department Name
        <input class="adm-input" formControlName="name" placeholder="e.g Mathematics" />
      </label>
      <label>
        Code
        <input class="adm-input" formControlName="code" placeholder="e.g MTH" />
      </label>
      <div class="adm-dialog__actions">
        <button type="button" class="adm-btn adm-btn--outline" (click)="ref.close()">Cancel</button>
        <button type="submit" class="adm-btn" [disabled]="form.invalid">
          {{ department ? 'Save Changes' : 'Create Department' }}
        </button>
      </div>
    </form>
  `,
})
export class DepartmentDialog {
  readonly ref = inject(MatDialogRef<DepartmentDialog, IDepartmentDialogResult>);
  readonly department = inject<IDepartment | null>(MAT_DIALOG_DATA);

  form = new FormGroup({
    name: new FormControl(this.department?.name ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
    code: new FormControl(this.department?.code ?? '', { nonNullable: true }),
  });

  save(): void {
    if (this.form.invalid) return;
    const { name, code } = this.form.getRawValue();
    this.ref.close({ name: name.trim(), code: code.trim() || undefined });
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-departments',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatFormFieldModule, MatSelectModule],
  templateUrl: './departments.html',
})
export class Departments implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);

  loading = signal(false);
  schools = signal<ISchool[]>([]);
  faculties = signal<IFaculty[]>([]);
  departments = signal<IDepartment[]>([]);
  selectedSchoolId = signal('');
  selectedFacultyId = signal('');

  ngOnInit(): void {
    this.api.schools().subscribe({
      next: (resp) => {
        this.schools.set(resp.data ?? []);
        const first = resp.data?.[0];
        if (first) {
          this.selectedSchoolId.set(first._id);
          this.loadFaculties();
        }
      },
    });
  }

  onSchoolChange(schoolId: string): void {
    this.selectedSchoolId.set(schoolId);
    this.selectedFacultyId.set('');
    this.departments.set([]);
    this.loadFaculties();
  }

  onFacultyChange(facultyId: string): void {
    this.selectedFacultyId.set(facultyId);
    this.load();
  }

  private loadFaculties(): void {
    this.api.faculties(this.selectedSchoolId()).subscribe({
      next: (resp) => {
        this.faculties.set(resp.data ?? []);
        const first = resp.data?.[0];
        if (first) {
          this.selectedFacultyId.set(first._id);
          this.load();
        }
      },
    });
  }

  load(): void {
    const facultyId = this.selectedFacultyId();
    if (!facultyId) return;
    this.loading.set(true);
    this.api
      .departments(facultyId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resp) => this.departments.set(resp.data ?? []),
        error: () => this.toast.error('Could not load departments.'),
      });
  }

  create(): void {
    if (!this.selectedFacultyId()) return;
    this.dialog
      .open(DepartmentDialog, { data: null })
      .afterClosed()
      .subscribe((result: IDepartmentDialogResult | undefined) => {
        if (!result) return;
        this.api.createDepartment(this.selectedFacultyId(), result).subscribe({
          next: () => {
            this.toast.success('Department created.');
            this.load();
          },
          error: (err) =>
            this.toast.error(err?.error?.message ?? 'Could not create department.'),
        });
      });
  }

  edit(department: IDepartment): void {
    this.dialog
      .open(DepartmentDialog, { data: department })
      .afterClosed()
      .subscribe((result: IDepartmentDialogResult | undefined) => {
        if (!result) return;
        this.api.updateDepartment(department._id, result).subscribe({
          next: () => {
            this.toast.success('Department updated.');
            this.load();
          },
          error: (err) =>
            this.toast.error(err?.error?.message ?? 'Could not update department.'),
        });
      });
  }

  toggle(department: IDepartment): void {
    const next = !(department.isActive ?? true);
    this.api.updateDepartment(department._id, { isActive: next }).subscribe({
      next: () => {
        this.toast.success(next ? 'Department enabled.' : 'Department disabled.');
        this.load();
      },
      error: () => this.toast.error('Could not update department status.'),
    });
  }
}
