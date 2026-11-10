import {
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '../../core/models/admin.model';

export const STATUS_LABELS: Readonly<Record<TicketStatus, string>> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export const STATUS_ORDER: readonly TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

export const PRIORITY_LABELS: Readonly<Record<TicketPriority, string>> = {
  LOW: 'Low',
  NORMAL: 'Normal',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export const PRIORITY_ORDER: readonly TicketPriority[] = ['URGENT', 'HIGH', 'NORMAL', 'LOW'];

export const CATEGORY_LABELS: Readonly<Record<TicketCategory, string>> = {
  ACCOUNT_ACCESS: 'Account & sign-in',
  RESULTS: 'Results',
  REGISTRATION: 'Course registration',
  PAYMENTS: 'Payments & dues',
  TRANSCRIPT: 'Transcript',
  DATA_CORRECTION: 'Data correction',
  BUG: 'Bug',
  OTHER: 'Other',
};

export const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS) as TicketCategory[];

/** Field names the trail reports as edited. */
export const FIELD_LABELS: Readonly<Record<string, string>> = {
  title: 'title',
  description: 'description',
  category: 'category',
  priority: 'priority',
  school: 'school',
  reporterName: "reporter's name",
  reporterEmail: "reporter's email",
};

/**
 * Brand colours only: weight carries the meaning. The most pressing state is
 * solid blue, the next a tint, the rest neutral.
 */
export function statusChip(status: TicketStatus): string {
  if (status === 'OPEN') return 'adm-chip--brand';
  if (status === 'IN_PROGRESS') return 'adm-chip--tint';
  if (status === 'RESOLVED') return 'adm-chip--outline';
  return 'adm-chip--muted';
}

export function priorityChip(priority: TicketPriority): string {
  if (priority === 'URGENT') return 'adm-chip--brand';
  if (priority === 'HIGH') return 'adm-chip--tint';
  if (priority === 'NORMAL') return 'adm-chip--outline';
  return 'adm-chip--muted';
}

/** Mirrors `ticket-rules.ts` on the server, which has the final say. */
export const NEXT_STATUSES: Readonly<Record<TicketStatus, readonly TicketStatus[]>> = {
  OPEN: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['OPEN', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['OPEN', 'CLOSED'],
  CLOSED: ['OPEN'],
};

const isFinished = (status: TicketStatus) => status === 'RESOLVED' || status === 'CLOSED';

export function noteRequiredFor(from: TicketStatus, to: TicketStatus): boolean {
  if (from === 'RESOLVED' && to === 'CLOSED') return false;
  if (isFinished(to)) return true;
  return isFinished(from) && to === 'OPEN';
}

/** What the button for a move says, from where the ticket stands now. */
export function moveLabel(from: TicketStatus, to: TicketStatus): string {
  if (to === 'IN_PROGRESS') return 'Start work';
  if (to === 'RESOLVED') return 'Mark resolved';
  if (to === 'CLOSED') return 'Close';
  return isFinished(from) ? 'Reopen' : 'Back to open';
}
