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
import { IFaculty, ISchool } from '../../core/models/admin.model';
import { AdminApiService } from '../../core/services/admin-api.service';
import { ToastService } from '../../core/services/toast.service';
import { SkeletonTable } from '../../shared/skeleton';

// ─── Create/Edit dialog ───────────────────────────────────────────────────────

export interface IFacultyDialogResult {
  name: string;
  code?: string;
  /** Which school the faculty belongs to — chosen in the dialog, never guessed. */
  schoolId: string;
}

export interface IFacultyDialogData {
  faculty: IFaculty | null;
  schools: ISchool[];
  /** Preselected when the caller already has a school in context. */
  schoolId?: string;
}

@Component({
  selector: 'app-faculty-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatSelectModule],
  template: `
    <form class="adm-dialog" [formGroup]="form" (ngSubmit)="save()">
      <h2>{{ faculty ? 'Edit Faculty' : 'Create Faculty' }}</h2>
      <p>Faculties group departments within an institution</p>

      <!--
        Creating: the school is an explicit choice. It used to be inferred
        from whatever school happened to be first, which silently filed the
        faculty under the wrong institution. Editing: a faculty does not move
        between schools, so the field is not offered.
      -->
      @if (!faculty) {
        <label>
          School
          <mat-form-field appearance="outline" class="adm-mat">
            <mat-select formControlName="schoolId" placeholder="Choose a school">
              @for (school of context.schools; track school._id) {
                <mat-option [value]="school._id">{{ school.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </label>
      }

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
  readonly context = inject<IFacultyDialogData>(MAT_DIALOG_DATA);
  readonly faculty = this.context.faculty;

  form = new FormGroup({
    schoolId: new FormControl(this.context.schoolId ?? '', {
      nonNullable: true,
      // Required only when creating — an edit keeps its existing school.
      validators: this.context.faculty ? [] : [Validators.required],
    }),
    name: new FormControl(this.faculty?.name ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3)],
    }),
    code: new FormControl(this.faculty?.code ?? '', { nonNullable: true }),
  });

  save(): void {
    if (this.form.invalid) return;
    const { name, code, schoolId } = this.form.getRawValue();
    this.ref.close({
      name: name.trim(),
      code: code.trim() || undefined,
      schoolId,
    });
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-faculties',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatFormFieldModule, MatSelectModule, SkeletonTable],
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

  onSchoolChange(schoolId: string): void {
    this.selectedSchoolId.set(schoolId);
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
    this.dialog
      .open(FacultyDialog, {
        data: {
          faculty: null,
          schools: this.schools(),
          schoolId: this.selectedSchoolId(),
        },
      })
      .afterClosed()
      .subscribe((result: IFacultyDialogResult | undefined) => {
        if (!result) return;
        // Honour the school chosen in the dialog, not the page filter — they
        // can legitimately differ.
        this.api.createFaculty(result.schoolId, result).subscribe({
          next: () => {
            this.toast.success('Faculty created.');
            if (result.schoolId !== this.selectedSchoolId()) {
              this.selectedSchoolId.set(result.schoolId);
            }
            this.load();
          },
          error: (err) =>
            this.toast.error(err?.error?.message ?? 'Could not create faculty.'),
        });
      });
  }

  edit(faculty: IFaculty): void {
    this.dialog
      .open(FacultyDialog, {
        data: { faculty, schools: this.schools(), schoolId: this.selectedSchoolId() },
      })
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

  toggle(faculty: IFaculty): void {
    const next = !(faculty.isActive ?? true);
    this.api.updateFaculty(faculty._id, { isActive: next }).subscribe({
      next: () => {
        this.toast.success(next ? 'Faculty enabled.' : 'Faculty disabled.');
        this.load();
      },
      error: () => this.toast.error('Could not update faculty status.'),
    });
  }
}
