import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { IAPIResponse } from '../models/api-response.model';
import {
  IAdminInvite,
  IAdminProfile,
  ICreatedInvite,
  ICreateCoursePayload,
  ICurriculumImportReport,
  ICurriculumRow,
  IDepartment,
  IFaculty,
  IOverview,
  ISchool,
  ISchoolSettings,
} from '../models/admin.model';

/** One typed client for every admin-facing backend endpoint. */
@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.BASE_URL;

  // ── Team & invites ────────────────────────────────────────────────────────

  admins(): Observable<IAPIResponse<IAdminProfile[]>> {
    return this.http.get<IAPIResponse<IAdminProfile[]>>(`${this.base}/admins`);
  }

  invites(): Observable<IAPIResponse<IAdminInvite[]>> {
    return this.http.get<IAPIResponse<IAdminInvite[]>>(
      `${this.base}/admins/invites`,
    );
  }

  createInvite(email: string): Observable<IAPIResponse<ICreatedInvite>> {
    return this.http.post<IAPIResponse<ICreatedInvite>>(
      `${this.base}/admins/invites`,
      { email },
    );
  }

  revokeInvite(id: string): Observable<IAPIResponse<{ revoked: boolean }>> {
    return this.http.delete<IAPIResponse<{ revoked: boolean }>>(
      `${this.base}/admins/invites/${id}`,
    );
  }

  /** Public — invite redemption (no auth header needed, token in body). */
  registerWithInvite(body: {
    firstname: string;
    lastname: string;
    email: string;
    password: string;
    confirmPassword: string;
    inviteToken: string;
  }): Observable<IAPIResponse<unknown>> {
    return this.http.post<IAPIResponse<unknown>>(
      `${this.base}/auth/admins/register`,
      body,
    );
  }

  // ── Overview ──────────────────────────────────────────────────────────────

  overview(): Observable<IAPIResponse<IOverview>> {
    return this.http.get<IAPIResponse<IOverview>>(`${this.base}/admins/overview`);
  }

  schoolsWithCounts(): Observable<IAPIResponse<ISchool[]>> {
    return this.http.get<IAPIResponse<ISchool[]>>(
      `${this.base}/admins/overview/schools`,
    );
  }

  // ── Schools ───────────────────────────────────────────────────────────────

  schools(): Observable<IAPIResponse<ISchool[]>> {
    return this.http.get<IAPIResponse<ISchool[]>>(`${this.base}/schools`);
  }

  createSchool(body: {
    name: string;
    address?: string;
    acronym?: string;
  }): Observable<IAPIResponse<ISchool>> {
    return this.http.post<IAPIResponse<ISchool>>(`${this.base}/schools`, body);
  }

  updateSchool(
    id: string,
    body: Partial<{ name: string; address: string; acronym: string; isActive: boolean }>,
  ): Observable<IAPIResponse<ISchool>> {
    return this.http.patch<IAPIResponse<ISchool>>(`${this.base}/schools/${id}`, body);
  }

  // ── Faculties / Departments ───────────────────────────────────────────────

  faculties(schoolId: string): Observable<IAPIResponse<IFaculty[]>> {
    return this.http.get<IAPIResponse<IFaculty[]>>(
      `${this.base}/schools/${schoolId}/faculties`,
    );
  }

  createFaculty(
    schoolId: string,
    body: { name: string; code?: string },
  ): Observable<IAPIResponse<IFaculty>> {
    return this.http.post<IAPIResponse<IFaculty>>(
      `${this.base}/schools/${schoolId}/faculties`,
      body,
    );
  }

  updateFaculty(
    id: string,
    body: Partial<{ name: string; code: string; isActive: boolean }>,
  ): Observable<IAPIResponse<IFaculty>> {
    return this.http.patch<IAPIResponse<IFaculty>>(
      `${this.base}/schools/faculties/${id}`,
      body,
    );
  }

  departments(facultyId: string): Observable<IAPIResponse<IDepartment[]>> {
    return this.http.get<IAPIResponse<IDepartment[]>>(
      `${this.base}/schools/faculties/${facultyId}/departments`,
    );
  }

  createDepartment(
    facultyId: string,
    body: { name: string; code?: string },
  ): Observable<IAPIResponse<IDepartment>> {
    return this.http.post<IAPIResponse<IDepartment>>(
      `${this.base}/schools/faculties/${facultyId}/departments`,
      body,
    );
  }

  updateDepartment(
    id: string,
    body: Partial<{ name: string; code: string; isActive: boolean }>,
  ): Observable<IAPIResponse<IDepartment>> {
    return this.http.patch<IAPIResponse<IDepartment>>(
      `${this.base}/schools/faculties/departments/${id}`,
      body,
    );
  }

  // ── Curriculum ────────────────────────────────────────────────────────────

  curriculum(
    schoolId: string,
    departmentId: string,
    level?: string,
    semester?: string,
  ): Observable<IAPIResponse<ICurriculumRow[]>> {
    let params = new HttpParams()
      .append('schoolId', schoolId)
      .append('departmentId', departmentId);
    if (level) params = params.append('level', level);
    if (semester) params = params.append('semester', semester);
    return this.http.get<IAPIResponse<ICurriculumRow[]>>(`${this.base}/curriculum`, {
      params,
    });
  }

  importCurriculum(
    schoolId: string,
    file: File,
  ): Observable<IAPIResponse<ICurriculumImportReport>> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<IAPIResponse<ICurriculumImportReport>>(
      `${this.base}/curriculum/import?schoolId=${schoolId}`,
      form,
    );
  }

  get curriculumTemplateUrl(): string {
    return `${this.base}/curriculum/template`;
  }

  createCourse(body: ICreateCoursePayload): Observable<IAPIResponse<unknown>> {
    return this.http.post<IAPIResponse<unknown>>(`${this.base}/courses`, body);
  }

  /** Classify one course in a department's curriculum block. */
  upsertCurriculumEntry(
    schoolId: string,
    body: {
      departmentId: string;
      courseId: string;
      level: string;
      semester: string;
      units?: number;
      type: string;
      electiveGroup?: string;
      groupMinRequired?: number;
    },
  ): Observable<IAPIResponse<{ saved: boolean; blockIssues: unknown[] }>> {
    return this.http.post<IAPIResponse<{ saved: boolean; blockIssues: unknown[] }>>(
      `${this.base}/curriculum/entry?schoolId=${schoolId}`,
      body,
    );
  }

  blockMinUnits(
    departmentId: string,
    level: string,
    semester: string,
  ): Observable<IAPIResponse<{ minUnits: number }>> {
    const params = new HttpParams()
      .append('departmentId', departmentId)
      .append('level', level)
      .append('semester', semester);
    return this.http.get<IAPIResponse<{ minUnits: number }>>(
      `${this.base}/curriculum/block-settings`,
      { params },
    );
  }

  setBlockMinUnits(
    schoolId: string,
    body: { departmentId: string; level: string; semester: string; minUnits: number },
  ): Observable<IAPIResponse<unknown>> {
    return this.http.patch<IAPIResponse<unknown>>(
      `${this.base}/curriculum/block-settings?schoolId=${schoolId}`,
      body,
    );
  }

  /** Admin-triggered session rollover — promotes levels, remaps CA cohorts. */
  rolloverSession(
    schoolId: string,
    body: { fromSession: string; toSession: string },
  ): Observable<
    IAPIResponse<{
      fromSession: string;
      toSession: string;
      promotedByLevel: Record<string, number>;
      finalLevelUntouched: number;
      advisorsRemapped: number;
    }>
  > {
    return this.http.post<
      IAPIResponse<{
        fromSession: string;
        toSession: string;
        promotedByLevel: Record<string, number>;
        finalLevelUntouched: number;
        advisorsRemapped: number;
      }>
    >(`${this.base}/school-settings/rollover?schoolId=${schoolId}`, body);
  }

  // ── School settings (active session) ──────────────────────────────────────

  settings(schoolId: string): Observable<IAPIResponse<ISchoolSettings | null>> {
    return this.http.get<IAPIResponse<ISchoolSettings | null>>(
      `${this.base}/school-settings`,
      { params: new HttpParams().append('schoolId', schoolId) },
    );
  }

  updateSettings(
    schoolId: string,
    body: Partial<{
      activeSession: string;
      activeSemester: string;
      registrationGraceDays: number;
      registrationDeadline: string;
      registrationGate: 'AUTO' | 'OPEN' | 'CLOSED';
    }>,
  ): Observable<IAPIResponse<ISchoolSettings>> {
    return this.http.patch<IAPIResponse<ISchoolSettings>>(
      `${this.base}/school-settings`,
      body,
      { params: new HttpParams().append('schoolId', schoolId) },
    );
  }
}
