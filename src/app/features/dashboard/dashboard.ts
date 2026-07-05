import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { IOverview, ISchool } from '../../core/models/admin.model';
import { AdminApiService } from '../../core/services/admin-api.service';
import { ToastService } from '../../core/services/toast.service';
import { CourseDialog } from '../courses/courses';
import { DepartmentDialog, IDepartmentDialogResult } from '../departments/departments';
import { FacultyDialog, IFacultyDialogResult } from '../faculties/faculties';
import { ISchoolDialogResult, SchoolDialog } from '../schools/school-dialog';

interface IStatCard {
  label: string;
  value: number | string;
  caption: string;
  icon: string;
}

/** Dashboard Overview per the Figma: live platform stats + quick actions. */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  overview = signal<IOverview | null>(null);
  private schools: ISchool[] = [];

  readonly cards = signal<IStatCard[]>([]);

  ngOnInit(): void {
    this.api.overview().subscribe({
      next: (resp) => {
        this.overview.set(resp.data);
        this.cards.set([
          {
            label: 'Total Schools',
            value: resp.data.schools,
            caption: 'connected institutions',
            icon: '🏛️',
          },
          {
            label: 'Total Faculties',
            value: resp.data.faculties,
            caption: `${resp.data.departments} departments`,
            icon: '🏫',
          },
          {
            label: 'Total Lecturers',
            value: resp.data.lecturers,
            caption: 'staff accounts',
            icon: '👤',
          },
          {
            label: 'Total Students',
            value: resp.data.students,
            caption: `${resp.data.curriculumRows} curriculum entries`,
            icon: '🎓',
          },
        ]);
      },
      error: () => this.toast.error('Could not load platform stats.'),
    });
    this.api.schools().subscribe({ next: (resp) => (this.schools = resp.data ?? []) });
  }

  createSchool(): void {
    this.dialog
      .open(SchoolDialog, { data: null })
      .afterClosed()
      .subscribe((result: ISchoolDialogResult | undefined) => {
        if (!result) return;
        this.api.createSchool(result).subscribe({
          next: () => {
            this.toast.success('School created.');
            this.ngOnInit();
          },
          error: (err) =>
            this.toast.error(err?.error?.message ?? 'Could not create school.'),
        });
      });
  }

  createCourse(): void {
    this.dialog
      .open(CourseDialog, { data: { schools: this.schools } })
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
                next: () =>
                  this.toast.success(
                    `Course created and classified as ${classification}.`
                  ),
                error: () =>
                  this.toast.error(
                    'Course created, but classification failed — add it via curriculum import.'
                  ),
              });
          },
          error: (err) =>
            this.toast.error(err?.error?.message ?? 'Could not create course.'),
        });
      });
  }

  createFaculty(): void {
    const school = this.schools[0];
    if (!school) return;
    this.dialog
      .open(FacultyDialog, { data: null })
      .afterClosed()
      .subscribe((result: IFacultyDialogResult | undefined) => {
        if (!result) return;
        this.api.createFaculty(school._id, result).subscribe({
          next: () => {
            this.toast.success(`Faculty created in ${school.name}.`);
            this.ngOnInit();
          },
          error: (err) =>
            this.toast.error(err?.error?.message ?? 'Could not create faculty.'),
        });
      });
  }

  createDepartment(): void {
    // Department needs a faculty context — route to the full page.
    void this.router.navigate(['/department']);
  }
}
