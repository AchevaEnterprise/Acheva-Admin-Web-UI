import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { IAPIResponse } from '../models/api-response.model';
import {
  IAdminInvite,
  IAdminProfile,
  IBank,
  IReceiptPage,
  ISaveSchoolFeePlan,
  ISchoolFeeReceiptRow,
  SchoolFeeReceiptStatus,
  ISchoolFeeAccount,
  ISchoolFeePlanView,
  ICreatedInvite,
  ICreateCoursePayload,
  ICurriculumImportReport,
  ICurriculumRow,
  IDepartment,
  IDirectoryLecturer,
  IDirectoryStudent,
  IFaculty,
  ILecturerQuery,
  IOverview,
  IPage,
  ISchool,
  ISchoolSettings,
  IStudentQuery,
  ITicket,
  ITicketForm,
  ITicketQuery,
  ITicketRow,
  ITicketSummary,
  TicketStatus,
} from '../models/admin.model';

/** Query params from a filter object, leaving out anything unset. */
function toParams(query: object): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params = params.append(key, String(value));
  }
  return params;
}

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
    // Admin manages the full org tree — include deactivated faculties so they
    // can be seen and re-enabled (staff/sign-up dropdowns omit this flag).
    return this.http.get<IAPIResponse<IFaculty[]>>(
      `${this.base}/schools/${schoolId}/faculties?includeInactive=true`,
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
    // Include deactivated departments for admin management (see `faculties`).
    return this.http.get<IAPIResponse<IDepartment[]>>(
      `${this.base}/schools/faculties/${facultyId}/departments?includeInactive=true`,
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

  /** Options within a department's programme — set here, chosen by students. */
  addDepartmentOption(departmentId: string, name: string): Observable<IAPIResponse<IDepartment>> {
    return this.http.post<IAPIResponse<IDepartment>>(
      `${this.base}/schools/faculties/departments/${departmentId}/options`,
      { name },
    );
  }

  updateDepartmentOption(
    departmentId: string,
    optionId: string,
    body: Partial<{ name: string; isActive: boolean }>,
  ): Observable<IAPIResponse<IDepartment>> {
    return this.http.patch<IAPIResponse<IDepartment>>(
      `${this.base}/schools/faculties/departments/${departmentId}/options/${optionId}`,
      body,
    );
  }

  // ── School fees ───────────────────────────────────────────────────────────

  schoolFeePlan(schoolId: string, session?: string): Observable<IAPIResponse<ISchoolFeePlanView>> {
    return this.http.get<IAPIResponse<ISchoolFeePlanView>>(`${this.base}/school-fees/admin/plan`, {
      params: toParams({ schoolId, session }),
    });
  }

  saveSchoolFeePlan(body: ISaveSchoolFeePlan): Observable<IAPIResponse<ISchoolFeePlanView>> {
    return this.http.put<IAPIResponse<ISchoolFeePlanView>>(`${this.base}/school-fees/admin/plan`, body);
  }

  publishSchoolFeePlan(schoolId: string, session: string): Observable<IAPIResponse<ISchoolFeePlanView>> {
    return this.http.post<IAPIResponse<ISchoolFeePlanView>>(
      `${this.base}/school-fees/admin/plan/publish`,
      { schoolId, session },
    );
  }

  unpublishSchoolFeePlan(schoolId: string, session: string): Observable<IAPIResponse<ISchoolFeePlanView>> {
    return this.http.post<IAPIResponse<ISchoolFeePlanView>>(
      `${this.base}/school-fees/admin/plan/unpublish`,
      { schoolId, session },
    );
  }

  setSchoolFeeAccount(body: {
    schoolId: string;
    bankCode: string;
    accountNumber: string;
  }): Observable<IAPIResponse<ISchoolFeeAccount>> {
    return this.http.put<IAPIResponse<ISchoolFeeAccount>>(`${this.base}/school-fees/admin/account`, body);
  }

  /** Receipts students uploaded for fees paid elsewhere — to check. */
  schoolFeeReceipts(query: {
    schoolId: string;
    session?: string;
    status?: SchoolFeeReceiptStatus | '';
    page?: number;
    limit?: number;
  }): Observable<IAPIResponse<IReceiptPage>> {
    return this.http.get<IAPIResponse<IReceiptPage>>(`${this.base}/school-fees/admin/receipts`, {
      params: toParams(query),
    });
  }

  decideSchoolFeeReceipt(
    id: string,
    body: { status: 'VERIFIED' | 'REJECTED'; reason?: string },
  ): Observable<IAPIResponse<ISchoolFeeReceiptRow>> {
    return this.http.patch<IAPIResponse<ISchoolFeeReceiptRow>>(
      `${this.base}/school-fees/admin/receipts/${id}`,
      body,
    );
  }

  /** One file of a receipt, streamed by the API — the files are private. */
  schoolFeeReceiptFile(id: string, which: 'schoolFeeReceipt' | 'remitaReceipt'): Observable<Blob> {
    return this.http.get(`${this.base}/school-fees/receipts/${id}/files/${which}`, {
      responseType: 'blob',
    });
  }

  /** Banks Paystack can pay out to. */
  banks(): Observable<IAPIResponse<IBank[]>> {
    return this.http.get<IAPIResponse<IBank[]>>(`${this.base}/banks`);
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
      /** Approved department transfers carried out as the session closed. */
      transfersApplied?: number;
    }>
  > {
    return this.http.post<
      IAPIResponse<{
        fromSession: string;
        toSession: string;
        promotedByLevel: Record<string, number>;
        finalLevelUntouched: number;
        advisorsRemapped: number;
        transfersApplied?: number;
      }>
    >(`${this.base}/school-settings/rollover?schoolId=${schoolId}`, body);
  }

  // ── Directory ─────────────────────────────────────────────────────────────

  lecturers(query: ILecturerQuery): Observable<IAPIResponse<IPage<IDirectoryLecturer>>> {
    return this.http.get<IAPIResponse<IPage<IDirectoryLecturer>>>(`${this.base}/admins/lecturers`, {
      params: toParams(query),
    });
  }

  students(query: IStudentQuery): Observable<IAPIResponse<IPage<IDirectoryStudent>>> {
    return this.http.get<IAPIResponse<IPage<IDirectoryStudent>>>(`${this.base}/admins/students`, {
      params: toParams(query),
    });
  }

  /** Deactivation ends the lecturer's sessions on their next request. */
  setLecturerActive(id: string, isActive: boolean): Observable<IAPIResponse<unknown>> {
    return this.http.patch<IAPIResponse<unknown>>(
      `${this.base}/lecturers/toggle-active-status/${id}`,
      { isActive },
    );
  }

  /** Rewrites the student and every result entry that carries the number, atomically. */
  changeRegNo(
    studentId: string,
    newRegNo: string,
  ): Observable<IAPIResponse<{ oldRegNo: string; newRegNo: string; entriesUpdated: number }>> {
    return this.http.patch<
      IAPIResponse<{ oldRegNo: string; newRegNo: string; entriesUpdated: number }>
    >(`${this.base}/admins/students/${studentId}/regno`, { newRegNo });
  }

  // ── Tickets (Logs) ────────────────────────────────────────────────────────

  tickets(query: ITicketQuery): Observable<IAPIResponse<IPage<ITicketRow>>> {
    return this.http.get<IAPIResponse<IPage<ITicketRow>>>(`${this.base}/tickets`, {
      params: toParams(query),
    });
  }

  ticketSummary(): Observable<IAPIResponse<ITicketSummary>> {
    return this.http.get<IAPIResponse<ITicketSummary>>(`${this.base}/tickets/summary`);
  }

  ticket(id: string): Observable<IAPIResponse<ITicket>> {
    return this.http.get<IAPIResponse<ITicket>>(`${this.base}/tickets/${id}`);
  }

  createTicket(body: ITicketForm): Observable<IAPIResponse<ITicket>> {
    return this.http.post<IAPIResponse<ITicket>>(`${this.base}/tickets`, body);
  }

  updateTicket(id: string, body: Partial<ITicketForm>): Observable<IAPIResponse<ITicket>> {
    return this.http.patch<IAPIResponse<ITicket>>(`${this.base}/tickets/${id}`, body);
  }

  changeTicketStatus(
    id: string,
    status: TicketStatus,
    note?: string,
  ): Observable<IAPIResponse<ITicket>> {
    return this.http.post<IAPIResponse<ITicket>>(`${this.base}/tickets/${id}/status`, {
      status,
      note,
    });
  }

  addTicketNote(id: string, note: string): Observable<IAPIResponse<ITicket>> {
    return this.http.post<IAPIResponse<ITicket>>(`${this.base}/tickets/${id}/notes`, { note });
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
