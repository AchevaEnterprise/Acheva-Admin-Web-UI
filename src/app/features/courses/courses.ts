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
import { LEVELS, SEMESTERS } from '../../core/constants';
import {
  ICurriculumImportReport,
  ICurriculumRow,
  IDepartment,
  IFaculty,
  ISchool,
} from '../../core/models/admin.model';
import { AdminApiService } from '../../core/services/admin-api.service';
import { ToastService } from '../../core/services/toast.service';

// ─── Create Course dialog (per Figma) ────────────────────────────────────────

interface ICourseDialogContext {
  schools: ISchool[];
}

@Component({
  selector: 'app-course-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatSelectModule],
  template: `
    <form class="adm-dialog" [formGroup]="form" (ngSubmit)="save()">
      <h2>Create Course</h2>
      <p>Complete the fields below to set up your course</p>

      <label>
        Semester
        <mat-form-field appearance="outline" class="adm-mat">
          <mat-select formControlName="semester" placeholder="Choose a semester">
            @for (semester of semesters; track semester) {
              <mat-option [value]="semester">{{ semester }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </label>

      <label>
        Course Title
        <input class="adm-input" formControlName="courseTitle" placeholder="Fill a course title" />
      </label>

      <label>
        Course Code
        <input class="adm-input" formControlName="courseCode" placeholder="Fill a course code" />
      </label>

      <label>
        School
        <mat-form-field appearance="outline" class="adm-mat">
          <mat-select formControlName="school" placeholder="Choose a School" (selectionChange)="onSchool()">
            @for (school of context.schools; track school._id) {
              <mat-option [value]="school._id">{{ school.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </label>

      <label>
        Faculty
        <mat-form-field appearance="outline" class="adm-mat">
          <mat-select formControlName="faculty" placeholder="Choose a faculty" (selectionChange)="onFaculty()">
            @for (faculty of faculties(); track faculty._id) {
              <mat-option [value]="faculty._id">{{ faculty.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </label>

      <label>
        Department
        <mat-form-field appearance="outline" class="adm-mat">
          <mat-select formControlName="department" placeholder="Choose a department">
            @for (department of departments(); track department._id) {
              <mat-option [value]="department._id">{{ department.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </label>

      <label>
        Level
        <mat-form-field appearance="outline" class="adm-mat">
          <mat-select formControlName="level" placeholder="Choose a Level">
            @for (level of levels; track level) {
              <mat-option [value]="level">{{ level }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </label>

      <label>
        Course Load
        <span style="display: flex; align-items: center; gap: 10px">
          <input
            class="adm-input"
            style="width: 90px"
            type="number"
            min="0"
            max="12"
            formControlName="courseLoad"
          />
          <button type="button" class="adm-btn adm-btn--outline" style="padding: 8px 12px" (click)="bump(-1)">−</button>
          <button type="button" class="adm-btn" style="padding: 8px 12px" (click)="bump(1)">＋</button>
        </span>
      </label>

      <label>
        Classification (in the department's curriculum)
        <mat-form-field appearance="outline" class="adm-mat">
          <mat-select formControlName="classification">
            <mat-option value="COMPULSORY">COMPULSORY</mat-option>
            <mat-option value="ELECTIVE">ELECTIVE</mat-option>
            <mat-option value="SIWES">SIWES</mat-option>
          </mat-select>
        </mat-form-field>
      </label>

      @if (form.controls.classification.value === 'ELECTIVE') {
        <label>
          Elective Group (optional — "choose N of these")
          <input class="adm-input" formControlName="electiveGroup" placeholder="e.g 300-1-A (leave empty for a free elective)" />
        </label>
        @if (form.controls.electiveGroup.value) {
          <label>
            Minimum required from the group
            <input class="adm-input" style="width: 90px" type="number" min="1" formControlName="groupMinRequired" />
          </label>
        }
      }

      <div class="adm-dialog__actions">
        <button type="button" class="adm-btn adm-btn--outline" (click)="ref.close()">Cancel</button>
        <button type="submit" class="adm-btn" [disabled]="form.invalid">Create Course</button>
      </div>
    </form>
  `,
})
export class CourseDialog {
  readonly ref = inject(MatDialogRef<CourseDialog>);
  readonly context = inject<ICourseDialogContext>(MAT_DIALOG_DATA);
  private readonly api = inject(AdminApiService);

  readonly semesters = SEMESTERS;
  readonly levels = LEVELS;
  faculties = signal<IFaculty[]>([]);
  departments = signal<IDepartment[]>([]);

  form = new FormGroup({
    semester: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    courseTitle: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    courseCode: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    school: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    faculty: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    department: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    level: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    courseLoad: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), Validators.max(12)],
    }),
    classification: new FormControl('COMPULSORY', { nonNullable: true }),
    electiveGroup: new FormControl('', { nonNullable: true }),
    groupMinRequired: new FormControl(1, { nonNullable: true }),
  });

  onSchool(): void {
    const schoolId = this.form.controls.school.value;
    this.form.patchValue({ faculty: '', department: '' });
    this.departments.set([]);
    if (schoolId) {
      this.api.faculties(schoolId).subscribe({
        next: (resp) => this.faculties.set(resp.data ?? []),
      });
    }
  }

  onFaculty(): void {
    const facultyId = this.form.controls.faculty.value;
    this.form.patchValue({ department: '' });
    if (facultyId) {
      this.api.departments(facultyId).subscribe({
        next: (resp) => this.departments.set(resp.data ?? []),
      });
    }
  }

  bump(delta: number): void {
    const current = this.form.controls.courseLoad.value ?? 0;
    this.form.controls.courseLoad.setValue(
      Math.min(12, Math.max(0, current + delta)),
    );
  }

  save(): void {
    if (this.form.invalid) return;
    this.ref.close(this.form.getRawValue());
  }
}

// ─── Page: curriculum manager ────────────────────────────────────────────────

@Component({
  selector: 'app-courses',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatFormFieldModule, MatSelectModule],
  templateUrl: './courses.html',
})
export class Courses implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);

  readonly levels = LEVELS;
  readonly semesters = SEMESTERS;

  schools = signal<ISchool[]>([]);
  departments = signal<IDepartment[]>([]);
  rows = signal<ICurriculumRow[]>([]);
  report = signal<ICurriculumImportReport | null>(null);
  loading = signal(false);
  importing = signal(false);

  selectedSchoolId = signal('');
  selectedDepartmentId = signal('');
  selectedLevel = signal<string>('100');
  selectedSemester = signal<string>('1ST SEMESTER');
  /** The selected block's minimum unit load (override or the global 15). */
  blockMinUnits = signal<number>(15);
  savingBlockMin = signal(false);

  ngOnInit(): void {
    this.api.schools().subscribe({
      next: (resp) => {
        this.schools.set(resp.data ?? []);
        const first = resp.data?.[0];
        if (first) {
          this.selectedSchoolId.set(first._id);
          this.loadDepartments();
        }
      },
    });
  }

  private loadDepartments(): void {
    // Flatten every faculty's departments for the selected school.
    this.api.faculties(this.selectedSchoolId()).subscribe({
      next: (resp) => {
        const faculties = resp.data ?? [];
        this.departments.set([]);
        for (const faculty of faculties) {
          this.api.departments(faculty._id).subscribe({
            next: (departmentResp) => {
              this.departments.update((current) => {
                const merged = [...current, ...(departmentResp.data ?? [])];
                if (!this.selectedDepartmentId() && merged.length > 0) {
                  this.selectedDepartmentId.set(merged[0]._id);
                  this.load();
                }
                return merged;
              });
            },
          });
        }
      },
    });
  }

  onSchoolChange(schoolId: string): void {
    this.selectedSchoolId.set(schoolId);
    this.selectedDepartmentId.set('');
    this.rows.set([]);
    this.loadDepartments();
  }

  onDepartmentChange(departmentId: string): void {
    this.selectedDepartmentId.set(departmentId);
    this.load();
  }

  setLevel(level: string): void {
    this.selectedLevel.set(level);
    this.load();
  }

  setSemester(semester: string): void {
    this.selectedSemester.set(semester);
    this.load();
  }

  load(): void {
    if (!this.selectedSchoolId() || !this.selectedDepartmentId()) return;
    this.api
      .blockMinUnits(
        this.selectedDepartmentId(),
        this.selectedLevel(),
        this.selectedSemester(),
      )
      .subscribe({
        next: (resp) => this.blockMinUnits.set(resp.data?.minUnits ?? 15),
      });
    this.loading.set(true);
    this.api
      .curriculum(
        this.selectedSchoolId(),
        this.selectedDepartmentId(),
        this.selectedLevel(),
        this.selectedSemester(),
      )
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resp) => this.rows.set(resp.data ?? []),
        error: () => this.toast.error('Could not load the curriculum.'),
      });
  }

  totalUnits(): number {
    return this.rows().reduce((sum, row) => sum + row.units, 0);
  }

  onBlockMinInput(event: Event): void {
    this.blockMinUnits.set(Number((event.target as HTMLInputElement).value));
  }

  saveBlockMin(): void {
    if (!this.selectedSchoolId() || !this.selectedDepartmentId()) return;
    this.savingBlockMin.set(true);
    this.api
      .setBlockMinUnits(this.selectedSchoolId(), {
        departmentId: this.selectedDepartmentId(),
        level: this.selectedLevel(),
        semester: this.selectedSemester(),
        minUnits: this.blockMinUnits(),
      })
      .pipe(finalize(() => this.savingBlockMin.set(false)))
      .subscribe({
        next: () =>
          this.toast.success(
            `Minimum load for this block set to ${this.blockMinUnits()} units.`,
          ),
        error: (err) =>
          this.toast.error(err?.error?.message ?? 'Could not save the minimum.'),
      });
  }

  onImportFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !this.selectedSchoolId()) return;

    this.importing.set(true);
    this.api
      .importCurriculum(this.selectedSchoolId(), file)
      .pipe(finalize(() => this.importing.set(false)))
      .subscribe({
        next: (resp) => {
          this.report.set(resp.data);
          const issues =
            resp.data.rowErrors.length + resp.data.blockIssues.length;
          if (issues) {
            this.toast.error(
              `Imported with ${issues} issue(s) — see the report below.`,
            );
          } else {
            this.toast.success(
              `Curriculum imported: ${resp.data.entriesCreated} created, ${resp.data.entriesUpdated} updated.`,
            );
          }
          this.load();
        },
        error: (err) =>
          this.toast.error(err?.error?.message ?? 'Import failed.'),
      });
  }

  downloadTemplate(): void {
    window.open(this.api.curriculumTemplateUrl, '_blank');
  }

  createCourse(): void {
    this.dialog
      .open(CourseDialog, { data: { schools: this.schools() } })
      .afterClosed()
      .subscribe((payload) => {
        if (!payload) return;
        const { classification, electiveGroup, groupMinRequired, ...course } =
          payload;
        this.api.createCourse(course).subscribe({
          next: (resp) => {
            const created = resp.data as { _id?: string } | undefined;
            if (!created?._id) {
              this.toast.success('Course created.');
              return;
            }
            // Classify it in the department's curriculum right away.
            this.api
              .upsertCurriculumEntry(course.school, {
                departmentId: course.department,
                courseId: created._id,
                level: course.level,
                semester: course.semester,
                units: course.courseLoad,
                type: classification,
                electiveGroup: electiveGroup || undefined,
                groupMinRequired: electiveGroup ? groupMinRequired : undefined,
              })
              .subscribe({
                next: (entryResp) => {
                  const issues = entryResp.data?.blockIssues?.length ?? 0;
                  this.toast.success(
                    `Course created and classified as ${classification}.` +
                      (issues ? ` ${issues} block issue(s) — check the block.` : '')
                  );
                  this.load();
                },
                error: (err) =>
                  this.toast.error(
                    err?.error?.message ??
                      'Course created, but classification failed — add it via curriculum import.'
                  ),
              });
          },
          error: (err) =>
            this.toast.error(err?.error?.message ?? 'Could not create course.'),
        });
      });
  }
}
