import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import {
  IAdminProfile,
  ISchool,
  ITicket,
  ITicketEvent,
  TicketStatus,
} from '../../core/models/admin.model';
import { WIDE_DIALOG } from '../../core/dialog';
import { AdminApiService } from '../../core/services/admin-api.service';
import { ToastService } from '../../core/services/toast.service';
import { personName } from '../../core/people';
import { Skeleton } from '../../shared/skeleton';
import { TicketFormDialog, messageOf } from './ticket-form-dialog';
import {
  CATEGORY_LABELS,
  FIELD_LABELS,
  NEXT_STATUSES,
  PRIORITY_LABELS,
  STATUS_LABELS,
  moveLabel,
  noteRequiredFor,
  priorityChip,
  statusChip,
} from './ticket-labels';

interface IMove {
  readonly to: TicketStatus;
  readonly label: string;
  readonly needsNote: boolean;
}

/** One ticket: what it is, where it stands, and everything that happened to it. */
@Component({
  selector: 'app-ticket-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, ReactiveFormsModule, RouterLink, Skeleton],
  templateUrl: './ticket-detail.html',
  styles: `
    .ticket-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 300px;
      gap: 24px;
      align-items: start;
    }

    @media (max-width: 1100px) {
      .ticket-layout {
        grid-template-columns: 1fr;
      }
    }

    .ticket-description {
      white-space: pre-wrap;
      font-size: 0.875rem;
      line-height: 1.6;
      color: #1f2937;
      margin: 0;
    }

    .ticket-moves {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .ticket-trail {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
    }

    .ticket-trail li {
      position: relative;
      padding: 0 0 16px 20px;
      font-size: 0.8125rem;
      color: #374151;
    }

    .ticket-trail li::before {
      content: '';
      position: absolute;
      left: 4px;
      top: 6px;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #77bbff;
    }

    .ticket-trail li:not(:last-child)::after {
      content: '';
      position: absolute;
      left: 7px;
      top: 16px;
      bottom: 0;
      width: 1px;
      background: #e5e7eb;
    }

    .ticket-trail time {
      display: block;
      font-size: 0.75rem;
      color: #9ca3af;
    }

    .ticket-quote {
      margin: 6px 0 0;
      padding: 8px 12px;
      border-left: 2px solid #77bbff;
      background: #f8fbff;
      white-space: pre-wrap;
      color: #1f2937;
    }

    .ticket-resolution {
      padding: 12px 16px;
      border-radius: 8px;
      background: rgb(119 187 255 / 12%);
      font-size: 0.8125rem;
      color: #1f2937;
    }
  `,
})
export class TicketDetail implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly statusLabels = STATUS_LABELS;
  readonly priorityLabels = PRIORITY_LABELS;
  readonly categoryLabels = CATEGORY_LABELS;
  readonly statusChip = statusChip;
  readonly priorityChip = priorityChip;
  readonly personName = personName;

  readonly ticket = signal<ITicket | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly schools = signal<ISchool[]>([]);
  readonly admins = signal<IAdminProfile[]>([]);

  /** A move that needs a note, waiting for one. */
  readonly pendingMove = signal<IMove | null>(null);
  readonly moveNote = new FormControl('', { nonNullable: true });
  readonly note = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(2000)],
  });

  readonly moves = computed<IMove[]>(() => {
    const ticket = this.ticket();
    if (!ticket) return [];
    return NEXT_STATUSES[ticket.status].map((to) => ({
      to,
      label: moveLabel(ticket.status, to),
      needsNote: noteRequiredFor(ticket.status, to),
    }));
  });

  /** Oldest first, as a log reads. */
  readonly trail = computed(() => this.ticket()?.events ?? []);

  private id = '';

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.id = params.get('id') ?? '';
      this.load();
    });
    this.api.schools().subscribe({ next: (resp) => this.schools.set(resp.data ?? []) });
    this.api.admins().subscribe({ next: (resp) => this.admins.set(resp.data ?? []) });
  }

  private load(): void {
    this.loading.set(true);
    this.api
      .ticket(this.id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resp) => this.ticket.set(resp.data),
        error: (err) => this.toast.error(messageOf(err, 'Could not load the ticket.')),
      });
  }

  // ── Status ───────────────────────────────────────────────────────────────

  choose(move: IMove): void {
    if (move.needsNote) {
      this.moveNote.reset();
      this.pendingMove.set(move);
      return;
    }
    this.move(move.to);
  }

  confirmMove(): void {
    const move = this.pendingMove();
    const note = this.moveNote.value.trim();
    if (!move || !note) return;
    this.move(move.to, note);
  }

  notePrompt(move: IMove): string {
    if (move.to === 'RESOLVED') return 'How was it resolved?';
    if (move.to === 'CLOSED') return 'Why is it being closed without a fix?';
    return 'What brought it back?';
  }

  private move(to: TicketStatus, note?: string): void {
    const ticket = this.ticket();
    if (!ticket || this.busy()) return;
    this.busy.set(true);
    this.api
      .changeTicketStatus(ticket._id, to, note)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (resp) => {
          this.ticket.set(resp.data);
          this.pendingMove.set(null);
          this.toast.success(`${resp.data.reference} is now ${STATUS_LABELS[to].toLowerCase()}.`);
        },
        error: (err) => {
          this.toast.error(messageOf(err, 'Could not change the status.'));
          // Someone else moved it: show them where it actually stands.
          if (err?.status === 409) this.load();
        },
      });
  }

  // ── Owner, notes, edits ──────────────────────────────────────────────────

  assign(event: Event): void {
    const ticket = this.ticket();
    if (!ticket) return;
    const assignee = (event.target as HTMLSelectElement).value || null;
    this.busy.set(true);
    this.api
      .updateTicket(ticket._id, { assignee })
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (resp) => this.ticket.set(resp.data),
        error: (err) => this.toast.error(messageOf(err, 'Could not reassign the ticket.')),
      });
  }

  addNote(): void {
    const ticket = this.ticket();
    const note = this.note.value.trim();
    if (!ticket || !note || this.busy()) return;
    this.busy.set(true);
    this.api
      .addTicketNote(ticket._id, note)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (resp) => {
          this.ticket.set(resp.data);
          this.note.reset();
        },
        error: (err) => this.toast.error(messageOf(err, 'Could not add the note.')),
      });
  }

  edit(): void {
    const ticket = this.ticket();
    if (!ticket) return;
    this.dialog
      .open(TicketFormDialog, {
        ...WIDE_DIALOG,
        data: { schools: this.schools(), admins: this.admins(), ticket },
      })
      .afterClosed()
      .subscribe((saved: ITicket | undefined) => {
        if (saved) this.ticket.set(saved);
      });
  }

  // ── The trail ────────────────────────────────────────────────────────────

  describe(event: ITicketEvent): string {
    const who = personName(event.by);
    switch (event.type) {
      case 'CREATED':
        return `${who} raised the ticket`;
      case 'UPDATED':
        return `${who} edited the ${joinWords(event.fields.map((field) => FIELD_LABELS[field] ?? field))}`;
      case 'ASSIGNED':
        if (!event.assignee) return `${who} unassigned it`;
        return event.assignee._id === event.by?._id
          ? `${who} took it`
          : `${who} assigned it to ${personName(event.assignee)}`;
      case 'STATUS_CHANGED':
        return this.describeMove(who, event);
      case 'NOTE':
        return `${who} added a note`;
    }
  }

  private describeMove(who: string, event: ITicketEvent): string {
    const to = event.to;
    if (to === 'IN_PROGRESS') return `${who} started work on it`;
    if (to === 'RESOLVED') return `${who} resolved it`;
    if (to === 'CLOSED') return `${who} closed it`;
    if (event.from === 'RESOLVED' || event.from === 'CLOSED') return `${who} reopened it`;
    return `${who} moved it back to open`;
  }
}

/** "title, priority and school" */
function joinWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? 'details';
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}
