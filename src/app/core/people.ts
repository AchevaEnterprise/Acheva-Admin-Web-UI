import { IDirectoryLecturer, IPersonRef, LecturerRole } from './models/admin.model';

/** How each office reads on a page. */
export const ROLE_LABELS: Readonly<Record<LecturerRole, string>> = {
  LECTURER: 'Lecturer',
  COURSE_COORDINATOR: 'Course Coordinator',
  COURSE_ADVISOR: 'Course Advisor',
  HOD: 'Head of Department',
  DEAN: 'Dean',
};

export const ROLE_OPTIONS: readonly LecturerRole[] = [
  'LECTURER',
  'COURSE_COORDINATOR',
  'COURSE_ADVISOR',
  'HOD',
  'DEAN',
];

/**
 * A lecturer's name, or — for the office accounts that carry none, like
 * `hod.maths@futo.edu.ng` — the office the way every document names it:
 * "HOD MTH", "DEAN SOPS". Never the raw email.
 */
export function lecturerName(lecturer: IDirectoryLecturer): string {
  const name = [lecturer.firstname, lecturer.middlename, lecturer.lastname]
    .filter((part) => part && part.trim())
    .join(' ');
  if (name) return [...(lecturer.titles ?? []), name].join(' ');
  if (lecturer.role === 'HOD' && lecturer.department?.code) return `HOD ${lecturer.department.code}`;
  if (lecturer.role === 'DEAN' && lecturer.faculty?.code) return `DEAN ${lecturer.faculty.code}`;
  return lecturer.email.split('@')[0];
}

/** Every office they hold — the one in use first. */
export function officesOf(lecturer: IDirectoryLecturer): LecturerRole[] {
  return [lecturer.role, ...(lecturer.otherRoles ?? [])].filter(
    (role, index, all) => !!role && all.indexOf(role) === index,
  );
}

/** "200 level", with the intake when the advisor is keyed on one. */
export function advisorCohort(lecturer: IDirectoryLecturer): string | null {
  const level = lecturer.assignedLevel;
  if (!level || level === 'NONE') return null;
  const label = /^\d+$/.test(level)
    ? `${level} level`
    : `${level.charAt(0)}${level.slice(1).toLowerCase()} students`;
  const intake = lecturer.assignedLevelAdmissionYear;
  return intake ? `${label} · ${intake} intake` : label;
}

export function personName(person: IPersonRef | null | undefined): string {
  if (!person) return '—';
  const name = [person.firstname, person.lastname].filter(Boolean).join(' ');
  return name || person.email || '—';
}
