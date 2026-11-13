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
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { finalize } from 'rxjs';
import {
  IDepartment,
  IDepartmentOption,
  IFaculty,
  ISchool,
} from '../../core/models/admin.model';
import { LEVEL_COUNT_CHOICES, levelRangeLabel } from '../../core/department-levels';
import { WIDE_DIALOG } from '../../core/dialog';
import { AdminApiService } from '../../core/services/admin-api.service';
import { ToastService } from '../../core/services/toast.service';
import { SkeletonTable } from '../../shared/skeleton';

// ─── Create/Edit dialog ───────────────────────────────────────────────────────

export interface IDepartmentDialogResult {
  name: string;
  /** Short code printed on official documents (MTH). Required. */
  code: string;
  /** How many levels the programme runs. Required. */
  levelCount: number;
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
      <!-- Label text in its own span: the label is a flex column, so a bare
           asterisk landed on a line of its own. -->
      <label>
        <span>Department Name <span class="adm-req">*</span></span>
        <input class="adm-input" formControlName="name" placeholder="e.g Mathematics" />
      </label>
      <label>
        <span>Code <span class="adm-req">*</span></span>
        <input class="adm-input" formControlName="code" placeholder="e.g MTH" />
      </label>
      <label>
        <span>Number of levels <span class="adm-req">*</span></span>
        <select class="adm-select" formControlName="levelCount">
          <option [ngValue]="null" disabled>Choose how many levels</option>
          @for (count of levelChoices; track count) {
            <option [ngValue]="count">{{ count }} {{ count === 1 ? 'level' : 'levels' }} · {{ rangeLabel(count) }}</option>
          }
        </select>
        <span class="dep-hint">
          The programme's length. Its last level is final year: students there graduate,
          or go into extra year if they still owe a course.
        </span>
      </label>
      <div class="adm-dialog__actions">
        <button type="button" class="adm-btn adm-btn--outline" (click)="ref.close()">Cancel</button>
        <button type="submit" class="adm-btn" [disabled]="form.invalid">
          {{ department ? 'Save Changes' : 'Create Department' }}
        </button>
      </div>
    </form>
  `,
  styles: `
    .dep-hint { font-size: 0.75rem; font-weight: 400; color: #6b7280; }
  `,
})
export class DepartmentDialog {
  readonly ref = inject(MatDialogRef<DepartmentDialog, IDepartmentDialogResult>);
  readonly department = inject<IDepartment | null>(MAT_DIALOG_DATA);
  readonly levelChoices = LEVEL_COUNT_CHOICES;
  readonly rangeLabel = levelRangeLabel;

  form = new FormGroup({
    name: new FormControl(this.department?.name ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
    // Required: FUTO's Official Grade Report prints this code, and a
    // department without one leaves a blank on a signed academic record.
    code: new FormControl(this.department?.code ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(10)],
    }),
    // Required, including when editing an older department that has none:
    // the rollover, graduation and school fees all read it.
    levelCount: new FormControl<number | null>(this.department?.levelCount ?? null, {
      validators: [Validators.required],
    }),
  });

  save(): void {
    if (this.form.invalid) return;
    const { name, code, levelCount } = this.form.getRawValue();
    if (levelCount === null) return;
    this.ref.close({ name: name.trim(), code: code.trim().toUpperCase(), levelCount });
  }
}

// ─── Options dialog ───────────────────────────────────────────────────────────

/**
 * The options within a department's programme (2026-11-09). Students choose
 * theirs from this list and school fees can differ by option, so an option
 * is renamed or switched off — never deleted — and a rename reaches every
 * student who chose it.
 */
@Component({
  selector: 'app-department-options',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <div class="adm-dialog">
      <h2>Options · {{ department.name }}</h2>
      <p>
        Specialisations within the programme. Students choose theirs from this
        list, and school fees can differ by option. Switching one off stops new
        choices; students already in it keep it.
      </p>

      @if (options().length === 0) {
        <p class="adm-empty">
          No options yet — students in this department are not asked to choose one.
        </p>
      } @else {
        <ul class="opt-list">
          @for (option of options(); track option._id) {
            <li class="opt-list__row" [class.opt-list__row--off]="option.isActive === false">
              <input
                class="adm-input"
                [attr.aria-label]="'Name of ' + option.name"
                [value]="draftFor(option)"
                (input)="setDraft(option, $any($event.target).value)"
              />
              <button
                type="button"
                class="adm-btn adm-btn--outline"
                [disabled]="busy() || !renamed(option)"
                (click)="rename(option)"
              >
                Rename
              </button>
              <button
                type="button"
                class="adm-toggle"
                [class.adm-toggle--on]="option.isActive !== false"
                [attr.aria-label]="option.isActive === false ? 'Switch ' + option.name + ' on' : 'Switch ' + option.name + ' off'"
                [disabled]="busy()"
                (click)="toggle(option)"
              ></button>
            </li>
          }
        </ul>
      }

      <form class="opt-add" [formGroup]="form" (ngSubmit)="add()">
        <label class="adm-field opt-add__field">
          <span class="adm-field__label">New option</span>
          <input class="adm-input" formControlName="name" placeholder="e.g Statistics" />
        </label>
        <button type="submit" class="adm-btn" [disabled]="busy() || form.invalid">Add option</button>
      </form>

      <div class="adm-dialog__actions">
        <button type="button" class="adm-btn adm-btn--outline" (click)="ref.close(changed)">Done</button>
      </div>
    </div>
  `,
})
export class DepartmentOptionsDialog {
  readonly ref = inject(MatDialogRef<DepartmentOptionsDialog, boolean>);
  readonly department = inject<IDepartment>(MAT_DIALOG_DATA);
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);

  readonly options = signal<readonly IDepartmentOption[]>(this.department.options ?? []);
  readonly busy = signal(false);
  private readonly drafts = signal<Record<string, string>>({});
  /** Tells the page to reload when the dialog closes. */
  changed = false;

  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80)],
    }),
  });

  draftFor(option: IDepartmentOption): string {
    return this.drafts()[option._id] ?? option.name;
  }

  setDraft(option: IDepartmentOption, value: string): void {
    this.drafts.update((drafts) => ({ ...drafts, [option._id]: value }));
  }

  renamed(option: IDepartmentOption): boolean {
    const draft = this.drafts()[option._id]?.trim();
    return !!draft && draft !== option.name;
  }

  add(): void {
    const name = this.form.getRawValue().name.trim();
    if (!name) return;
    this.run(this.api.addDepartmentOption(this.department._id, name), `Added ${name}.`, () =>
      this.form.reset(),
    );
  }

  rename(option: IDepartmentOption): void {
    const name = this.draftFor(option).trim();
    this.run(
      this.api.updateDepartmentOption(this.department._id, option._id, { name }),
      `Renamed to ${name}. Students who chose it now show the new name.`,
    );
  }

  toggle(option: IDepartmentOption): void {
    const isActive = option.isActive === false;
    this.run(
      this.api.updateDepartmentOption(this.department._id, option._id, { isActive }),
      isActive ? `${option.name} can be chosen again.` : `${option.name} switched off for new choices.`,
    );
  }

  private run(
    request: ReturnType<AdminApiService['addDepartmentOption']>,
    done: string,
    after?: () => void,
  ): void {
    this.busy.set(true);
    request.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: (resp) => {
        this.options.set(resp.data?.options ?? []);
        this.drafts.set({});
        this.changed = true;
        this.toast.success(done);
        after?.();
      },
      error: (err) => this.toast.error(err?.error?.message ?? 'Could not save the option.'),
    });
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-departments',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatFormFieldModule, MatSelectModule, SkeletonTable],
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
        // Send the count only when it changed: the server re-checks it
        // against students and curriculum, which a rename should not trip.
        const { levelCount, ...rest } = result;
        const body = levelCount === department.levelCount ? rest : result;
        this.api.updateDepartment(department._id, body).subscribe({
          next: () => {
            this.toast.success('Department updated.');
            this.load();
          },
          error: (err) =>
            this.toast.error(err?.error?.message ?? 'Could not update department.'),
        });
      });
  }

  /** "100 to 500 Level" for the table; null when Acheva has not set it. */
  levelsLabel(department: IDepartment): string | null {
    return department.levelCount ? levelRangeLabel(department.levelCount) : null;
  }

  /** Active option names, for the table. */
  readonly activeOptions = computed(() => {
    const names = new Map<string, string[]>();
    for (const department of this.departments()) {
      names.set(
        department._id,
        (department.options ?? []).filter((option) => option.isActive !== false).map((option) => option.name),
      );
    }
    return names;
  });

  manageOptions(department: IDepartment): void {
    this.dialog
      .open(DepartmentOptionsDialog, { ...WIDE_DIALOG, data: department })
      .afterClosed()
      .subscribe((changed: boolean | undefined) => {
        if (changed) this.load();
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
