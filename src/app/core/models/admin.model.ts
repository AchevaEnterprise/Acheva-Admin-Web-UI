/** Mirrors acheva-nestjs admin-facing endpoints. */

export interface IAdminProfile {
  readonly id: string;
  /** Rows from `GET /admins` carry `_id`; the signed-in account carries `id`. */
  readonly _id?: string;
  readonly firstname: string;
  readonly lastname: string;
  readonly email: string;
  readonly accountType: 'ADMIN';
}

export interface IOverview {
  readonly schools: number;
  readonly faculties: number;
  readonly departments: number;
  readonly courses: number;
  readonly lecturers: number;
  readonly students: number;
  readonly curriculumRows: number;
}

export interface ISchool {
  readonly _id: string;
  readonly name: string;
  readonly address?: string;
  readonly acronym?: string;
  readonly establishedYear?: number;
  readonly isActive?: boolean;
  readonly totalStudents?: number;
  readonly totalLecturers?: number;
}

export interface IFaculty {
  readonly _id: string;
  readonly name: string;
  readonly code?: string;
  readonly school: string;
  readonly isActive?: boolean;
}

/**
 * A specialisation within a department's programme ("Statistics"). Acheva
 * sets the list; students choose from it, and school fees can differ by it.
 * Never deleted — switched off instead.
 */
export interface IDepartmentOption {
  readonly _id: string;
  readonly name: string;
  readonly isActive?: boolean;
}

export interface IDepartment {
  readonly _id: string;
  readonly name: string;
  readonly code?: string;
  readonly faculty: string;
  readonly isActive?: boolean;
  readonly options?: readonly IDepartmentOption[];
  /** How many levels the programme runs (5 → 100 to 500). Null on older departments. */
  readonly levelCount?: number | null;
}

// ── School fees (2026-11-09) ────────────────────────────────────────────────

export interface IBank {
  readonly bankCode: string;
  readonly bankName: string;
}

/** The university's payout account — where every school-fee payment settles. */
export interface ISchoolFeeAccount {
  readonly accountName: string;
  readonly accountNumber: string;
  readonly bankCode: string;
  readonly bankName: string | null;
  /** Paystack acknowledged it; without that nobody can pay. */
  readonly verified: boolean;
}

export interface ISchoolFeeDueDate {
  readonly position: number;
  readonly dueDate: string;
  readonly note: string | null;
}

/** One fee: a department × level, and an option where it is charged differently. KOBO. */
export interface ISchoolFeeRow {
  readonly _id: string;
  readonly department: string;
  readonly level: string;
  readonly option: string | null;
  readonly amountKobo: number;
  /** Set once a student has paid against it — it can no longer change. */
  readonly collectionStartedAt: string | null;
}

export interface ISchoolFeeDepartment {
  readonly _id: string;
  readonly name: string;
  readonly code?: string;
  readonly faculty: string | null;
  /** '100' … the department's final level. */
  readonly levels: readonly string[];
  readonly options: readonly { _id: string; name: string; isActive: boolean }[];
}

export interface ISchoolFeePlanView {
  readonly school: { _id: string; name: string };
  readonly session: string;
  readonly activeSession: string | null;
  readonly sessions: readonly string[];
  readonly plan: {
    readonly status: 'DRAFT' | 'PUBLISHED';
    readonly instalments: readonly ISchoolFeeDueDate[];
    readonly publishedAt: string | null;
    readonly collectionStartedAt: string | null;
  } | null;
  readonly fees: readonly ISchoolFeeRow[];
  readonly departments: readonly ISchoolFeeDepartment[];
  readonly account: ISchoolFeeAccount | null;
}

export type SchoolFeeReceiptStatus = 'UNCHECKED' | 'VERIFIED' | 'REJECTED';

/**
 * A school-fee payment made outside Acheva, proved by its receipts. It
 * counts from upload; Acheva verifies or rejects it here until the AI check
 * (which will read the Remita QR code) exists. KOBO.
 */
export interface ISchoolFeeReceiptRow {
  readonly _id: string;
  readonly session: string;
  readonly rrr: string;
  readonly amount: number;
  readonly status: SchoolFeeReceiptStatus;
  readonly reason: string | null;
  readonly uploadedAt: string | null;
  readonly student: { _id: string; fullName: string; registrationNumber: string; level: string | null };
  readonly department: string | null;
}

export interface IReceiptPage {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  /** Across the school, whatever the filter — what still needs looking at. */
  readonly unchecked: number;
  readonly data: readonly ISchoolFeeReceiptRow[];
}

export interface ISaveSchoolFeePlan {
  readonly schoolId: string;
  readonly session: string;
  readonly instalments: readonly { dueDate: string; note?: string | null }[];
  readonly fees: readonly {
    department: string;
    level: string;
    option: string | null;
    amountKobo: number;
  }[];
}

export interface ICurriculumRow {
  readonly _id: string;
  readonly course: {
    _id: string;
    courseCode: string;
    courseTitle: string;
  };
  readonly units: number;
  readonly courseType: 'COMPULSORY' | 'ELECTIVE' | 'SIWES';
  readonly electiveGroup: string | null;
  readonly groupMinRequired: number | null;
  readonly level: string;
  readonly semester: string;
}

export interface ICurriculumImportReport {
  readonly rowsReceived: number;
  readonly entriesCreated: number;
  readonly entriesUpdated: number;
  readonly coursesCreated: number;
  readonly blockIssues: ReadonlyArray<{
    department: string;
    level: string;
    semester: string;
    issue: string;
  }>;
  readonly rowErrors: string[];
}

export interface ISchoolSettings {
  readonly _id: string;
  readonly school: string;
  readonly activeSession: string;
  readonly activeSemester: string;
  readonly registrationGraceDays: number;
  readonly registrationDeadline?: string | null;
  readonly registrationGate?: 'AUTO' | 'OPEN' | 'CLOSED';
  readonly updatedAt?: string;
}

export interface ICreateCoursePayload {
  semester: string;
  courseTitle: string;
  courseCode: string;
  school: string;
  faculty: string;
  department: string;
  level: string;
  courseLoad: number;
}

export interface IAdminInvite {
  readonly _id: string;
  readonly email: string;
  readonly expiresAt: string;
  readonly usedAt: string | null;
  readonly invitedBy?: { firstname: string; lastname: string; email: string };
  readonly createdAt?: string;
}

export interface ICreatedInvite {
  readonly _id: string;
  readonly email: string;
  readonly expiresAt: string;
  readonly inviteLink: string;
}

/**
 * Acheva's own commercial settings — the figures WE own.
 *
 * Note what is NOT here: the departmental dues amount. A Head of Department
 * sets what their department charges; this is only Acheva's cut of it.
 * (The transcript download fee went on 2026-11-10 — downloads are free.)
 *
 * Amounts are KOBO. See `core/naira.ts` for the only place they meet naira.
 */
export interface IPlatformSettings {
  readonly duesPlatformFeeKobo: number;
  readonly updatedBy?: string | null;
  readonly updatedAt?: string;
}

export interface IUpdatePlatformSettings {
  readonly duesPlatformFeeKobo?: number;
}

// ── Directory (Lecturers / Students pages) ──────────────────────────────────

/** A page of rows from a paginated admin endpoint. */
export interface IPage<T> {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly data: T[];
}

/** A school, faculty or department as a directory row carries it. */
export interface IUnitRef {
  readonly _id: string;
  readonly name: string;
  readonly code?: string;
  readonly acronym?: string;
}

export type LecturerRole =
  | 'LECTURER'
  | 'COURSE_COORDINATOR'
  | 'COURSE_ADVISOR'
  | 'HOD'
  | 'DEAN';

export type AccountStatusFilter = 'ACTIVE' | 'DEACTIVATED';

export interface IDirectoryLecturer {
  readonly _id: string;
  readonly titles?: string[];
  readonly firstname: string | null;
  readonly middlename: string | null;
  readonly lastname: string | null;
  readonly email: string;
  readonly role: LecturerRole;
  readonly otherRoles: LecturerRole[];
  readonly assignedLevel?: string | null;
  readonly assignedLevelAdmissionYear?: string | null;
  readonly school: IUnitRef | null;
  readonly faculty: IUnitRef | null;
  readonly department: IUnitRef | null;
  readonly isActive?: boolean;
  readonly emailVerified?: boolean;
  readonly createdAt?: string;
}

export interface IStudentTransferLeg {
  readonly department: IUnitRef | null;
  readonly faculty: IUnitRef | null;
  readonly level: string;
  readonly admissionYear: string | null;
  readonly session: string | null;
  readonly transferredAt: string;
}

export interface IDirectoryStudent {
  readonly _id: string;
  readonly fullName: string;
  readonly registrationNumber: string;
  readonly email?: string | null;
  readonly level: string;
  readonly admissionYear?: string | null;
  readonly originalAdmissionYear?: string | null;
  readonly session?: string | null;
  readonly school: IUnitRef | null;
  readonly faculty: IUnitRef | null;
  readonly department: IUnitRef | null;
  readonly isActive?: boolean;
  readonly deactivatedAt?: string | null;
  readonly emailVerified?: boolean;
  readonly sex?: 'MALE' | 'FEMALE' | null;
  readonly dateOfBirth?: string | null;
  readonly nationality?: string | null;
  readonly stateOfOrigin?: string | null;
  readonly modeOfEntry?: string | null;
  readonly programmeOption?: string | null;
  readonly transferredFrom?: IStudentTransferLeg[];
  /** Required details the student has not given yet — see the student portal's details page. */
  readonly missingDetails: string[];
  readonly academicStanding?: 'IN_PROGRAMME' | 'AWAITING_RESULTS' | 'EXTRA_YEAR' | 'GRADUATED';
  readonly extraYear?: number;
  readonly graduatedSession?: string | null;
  readonly createdAt?: string;
}

export interface IDirectoryQuery {
  readonly page: number;
  readonly limit: number;
  readonly school?: string;
  readonly faculty?: string;
  readonly department?: string;
  readonly search?: string;
  readonly status?: AccountStatusFilter;
}

export interface ILecturerQuery extends IDirectoryQuery {
  readonly role?: LecturerRole;
}

export interface IStudentQuery extends IDirectoryQuery {
  readonly level?: string;
  readonly details?: 'COMPLETE' | 'MISSING';
}

// ── Tickets (Logs page) ─────────────────────────────────────────────────────

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type TicketCategory =
  | 'ACCOUNT_ACCESS'
  | 'RESULTS'
  | 'REGISTRATION'
  | 'PAYMENTS'
  | 'TRANSCRIPT'
  | 'DATA_CORRECTION'
  | 'BUG'
  | 'OTHER';
export type TicketEventType = 'CREATED' | 'UPDATED' | 'ASSIGNED' | 'STATUS_CHANGED' | 'NOTE';

export interface IPersonRef {
  readonly _id: string;
  readonly firstname?: string;
  readonly lastname?: string;
  readonly email?: string;
}

export interface ITicketEvent {
  readonly _id: string;
  readonly type: TicketEventType;
  readonly by: IPersonRef | null;
  readonly at: string;
  readonly from: TicketStatus | null;
  readonly to: TicketStatus | null;
  readonly assignee: IPersonRef | null;
  readonly fields: string[];
  readonly note: string | null;
}

export interface ITicketRow {
  readonly _id: string;
  readonly number: number;
  /** TKT-0042 */
  readonly reference: string;
  readonly title: string;
  readonly category: TicketCategory;
  readonly priority: TicketPriority;
  readonly status: TicketStatus;
  readonly school: IUnitRef | null;
  readonly reporterName: string | null;
  readonly reporterEmail: string | null;
  readonly assignee: IPersonRef | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ITicket extends ITicketRow {
  readonly description: string;
  readonly createdBy: IPersonRef | null;
  readonly resolution: string | null;
  readonly resolvedAt: string | null;
  readonly closedAt: string | null;
  readonly events: ITicketEvent[];
}

export interface ITicketSummary {
  readonly byStatus: Record<TicketStatus, number>;
  readonly mine: number;
  readonly unassigned: number;
}

export interface ITicketQuery {
  readonly page: number;
  readonly limit: number;
  readonly status?: TicketStatus;
  readonly priority?: TicketPriority;
  readonly category?: TicketCategory;
  readonly school?: string;
  /** `me`, `unassigned`, or an admin's id. */
  readonly assignee?: string;
  readonly search?: string;
}

export interface ITicketForm {
  readonly title: string;
  readonly description: string;
  readonly category: TicketCategory;
  readonly priority: TicketPriority;
  readonly school: string | null;
  readonly reporterName: string | null;
  readonly reporterEmail: string | null;
  readonly assignee: string | null;
}

// ── Notifications (the header bell, 2026-11-11) ──────────────────────────────

/**
 * A notice addressed to this admin — today, a Head changing their department's
 * dues total. Shares the platform's `notifications` collection.
 */
export interface IAdminNotification {
  readonly _id: string;
  readonly title: string;
  readonly message: string;
  readonly status: 'UNREAD' | 'READ';
  readonly createdAt: string;
  readonly meta?: { readonly type?: string } | null;
}
