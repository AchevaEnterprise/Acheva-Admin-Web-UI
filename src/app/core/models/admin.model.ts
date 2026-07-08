/** Mirrors acheva-nestjs admin-facing endpoints. */

export interface IAdminProfile {
  readonly id: string;
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

export interface IDepartment {
  readonly _id: string;
  readonly name: string;
  readonly code?: string;
  readonly faculty: string;
  readonly isActive?: boolean;
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
