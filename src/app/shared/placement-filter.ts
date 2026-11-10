import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  output,
  signal,
} from '@angular/core';
import { IDepartment, IFaculty, ISchool } from '../core/models/admin.model';
import { AdminApiService } from '../core/services/admin-api.service';

export interface IPlacement {
  readonly school?: string;
  readonly faculty?: string;
  readonly department?: string;
}

/**
 * School → Faculty → Department, each optional and each narrowing the next.
 * "All" at any level means no filter from there down, so the page opens on
 * everyone rather than on whichever school happens to sort first.
 */
@Component({
  selector: 'app-placement-filter',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <div class="adm-field">
      <label class="adm-field__label" for="pf-school">School</label>
      <select id="pf-school" class="adm-select" [value]="school()" (change)="onSchool($event)">
        <option value="">All schools</option>
        @for (item of schools(); track item._id) {
          <option [value]="item._id">{{ item.name }}</option>
        }
      </select>
    </div>
    <div class="adm-field">
      <label class="adm-field__label" for="pf-faculty">Faculty</label>
      <select
        id="pf-faculty"
        class="adm-select"
        [value]="faculty()"
        [disabled]="!school()"
        (change)="onFaculty($event)"
      >
        <option value="">{{ school() ? 'All faculties' : 'Choose a school first' }}</option>
        @for (item of faculties(); track item._id) {
          <option [value]="item._id">{{ item.name }}</option>
        }
      </select>
    </div>
    <div class="adm-field">
      <label class="adm-field__label" for="pf-department">Department</label>
      <select
        id="pf-department"
        class="adm-select"
        [value]="department()"
        [disabled]="!faculty()"
        (change)="onDepartment($event)"
      >
        <option value="">{{ faculty() ? 'All departments' : 'Choose a faculty first' }}</option>
        @for (item of departments(); track item._id) {
          <option [value]="item._id">{{ item.name }}</option>
        }
      </select>
    </div>
  `,
})
export class PlacementFilter implements OnInit {
  private readonly api = inject(AdminApiService);

  readonly changed = output<IPlacement>();

  readonly schools = signal<ISchool[]>([]);
  readonly faculties = signal<IFaculty[]>([]);
  readonly departments = signal<IDepartment[]>([]);
  readonly school = signal('');
  readonly faculty = signal('');
  readonly department = signal('');

  ngOnInit(): void {
    this.api.schools().subscribe({ next: (resp) => this.schools.set(resp.data ?? []) });
  }

  onSchool(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.school.set(id);
    this.faculty.set('');
    this.department.set('');
    this.faculties.set([]);
    this.departments.set([]);
    if (id) {
      this.api.faculties(id).subscribe({ next: (resp) => this.faculties.set(resp.data ?? []) });
    }
    this.emit();
  }

  onFaculty(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.faculty.set(id);
    this.department.set('');
    this.departments.set([]);
    if (id) {
      this.api.departments(id).subscribe({ next: (resp) => this.departments.set(resp.data ?? []) });
    }
    this.emit();
  }

  onDepartment(event: Event): void {
    this.department.set((event.target as HTMLSelectElement).value);
    this.emit();
  }

  private emit(): void {
    this.changed.emit({
      school: this.school() || undefined,
      faculty: this.faculty() || undefined,
      department: this.department() || undefined,
    });
  }
}
