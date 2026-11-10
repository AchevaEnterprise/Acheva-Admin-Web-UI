import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import {
  IAdminProfile,
  ISchool,
  ITicket,
  ITicketQuery,
  ITicketRow,
  ITicketSummary,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '../../core/models/admin.model';
import { WIDE_DIALOG } from '../../core/dialog';
import { AdminApiService } from '../../core/services/admin-api.service';
import { ToastService } from '../../core/services/toast.service';
import { personName } from '../../core/people';
import { Pager } from '../../shared/pager';
import { SkeletonTable } from '../../shared/skeleton';
import { TicketFormDialog } from './ticket-form-dialog';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  PRIORITY_LABELS,
  PRIORITY_ORDER,
  STATUS_LABELS,
  STATUS_ORDER,
  priorityChip,
  statusChip,
} from './ticket-labels';

const PAGE_SIZE = 20;

/**
 * The Logs page: every ticket the Acheva team has raised, from report to
 * resolution. Opens on what is still open — the work — not on everything.
 */
@Component({
  selector: 'app-logs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, Pager, SkeletonTable],
  templateUrl: './logs.html',
})
export class Logs implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly statuses = STATUS_ORDER;
  readonly statusLabels = STATUS_LABELS;
  readonly priorities = PRIORITY_ORDER;
  readonly priorityLabels = PRIORITY_LABELS;
  readonly categories = CATEGORY_ORDER;
  readonly categoryLabels = CATEGORY_LABELS;
  readonly statusChip = statusChip;
  readonly priorityChip = priorityChip;
  readonly personName = personName;

  readonly rows = signal<ITicketRow[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly summary = signal<ITicketSummary | null>(null);
  readonly schools = signal<ISchool[]>([]);
  readonly admins = signal<IAdminProfile[]>([]);
  readonly query = signal<ITicketQuery>({ page: 1, limit: PAGE_SIZE, status: 'OPEN' });

  private readonly search$ = new Subject<string>();

  ngOnInit(): void {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((search) => this.patch({ search: search.trim() || undefined }));
    this.api.schools().subscribe({ next: (resp) => this.schools.set(resp.data ?? []) });
    this.api.admins().subscribe({ next: (resp) => this.admins.set(resp.data ?? []) });
    this.load();
  }

  allCount(): number {
    const counts = this.summary()?.byStatus;
    return counts ? STATUS_ORDER.reduce((sum, status) => sum + (counts[status] ?? 0), 0) : 0;
  }

  setStatus(status: TicketStatus | undefined): void {
    this.patch({ status });
  }

  onPriority(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as TicketPriority | '';
    this.patch({ priority: value || undefined });
  }

  onCategory(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as TicketCategory | '';
    this.patch({ category: value || undefined });
  }

  onSchool(event: Event): void {
    this.patch({ school: (event.target as HTMLSelectElement).value || undefined });
  }

  onAssignee(event: Event): void {
    this.patch({ assignee: (event.target as HTMLSelectElement).value || undefined });
  }

  onSearch(event: Event): void {
    this.search$.next((event.target as HTMLInputElement).value);
  }

  goTo(page: number): void {
    this.query.update((query) => ({ ...query, page }));
    this.load();
  }

  open(ticket: ITicketRow): void {
    void this.router.navigate(['/logs', ticket._id]);
  }

  create(): void {
    this.dialog
      .open(TicketFormDialog, {
        ...WIDE_DIALOG,
        data: { schools: this.schools(), admins: this.admins() },
      })
      .afterClosed()
      .subscribe((created: ITicket | undefined) => {
        if (created) void this.router.navigate(['/logs', created._id]);
      });
  }

  private patch(change: Partial<ITicketQuery>): void {
    this.query.update((query) => ({ ...query, ...change, page: 1 }));
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.ticketSummary().subscribe({ next: (resp) => this.summary.set(resp.data) });
    this.api
      .tickets(this.query())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (resp) => {
          this.rows.set(resp.data?.data ?? []);
          this.total.set(resp.data?.total ?? 0);
        },
        error: (err) => this.toast.error(err?.error?.message ?? 'Could not load tickets.'),
      });
  }
}
