import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs';
import {
  IAdminProfile,
  ISchool,
  ITicket,
  ITicketForm,
  TicketCategory,
  TicketPriority,
} from '../../core/models/admin.model';
import { AdminApiService } from '../../core/services/admin-api.service';
import { ToastService } from '../../core/services/toast.service';
import { CATEGORY_LABELS, CATEGORY_ORDER, PRIORITY_LABELS, PRIORITY_ORDER } from './ticket-labels';

export interface ITicketFormContext {
  readonly schools: ISchool[];
  readonly admins: IAdminProfile[];
  /** Present when editing; absent when raising a new ticket. */
  readonly ticket?: ITicket;
}

/** Raise a ticket, or edit one's details. Closes with the saved ticket. */
@Component({
  selector: 'app-ticket-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <form class="adm-dialog adm-dialog--wide" [formGroup]="form" (ngSubmit)="save()">
      <h2>{{ editing ? 'Edit ' + context.ticket!.reference : 'New ticket' }}</h2>
      <p>
        {{
          editing
            ? 'Changes are recorded on the ticket’s activity.'
            : 'Log a problem so it has a number, an owner and a record of how it ended.'
        }}
      </p>

      <label>
        Title
        <input
          class="adm-input"
          formControlName="title"
          maxlength="140"
          placeholder="e.g. HOD MTH cannot see 200 level results"
        />
      </label>

      <label>
        What happened
        <textarea
          class="adm-input adm-textarea"
          formControlName="description"
          maxlength="5000"
          placeholder="What they were doing, what they expected, what they saw instead."
        ></textarea>
      </label>

      <div class="ticket-grid">
        <label>
          Category
          <select class="adm-select" formControlName="category">
            @for (category of categories; track category) {
              <option [value]="category">{{ categoryLabels[category] }}</option>
            }
          </select>
        </label>
        <label>
          Priority
          <select class="adm-select" formControlName="priority">
            @for (priority of priorities; track priority) {
              <option [value]="priority">{{ priorityLabels[priority] }}</option>
            }
          </select>
        </label>
        <label>
          School
          <select class="adm-select" formControlName="school">
            <option value="">Platform-wide</option>
            @for (school of context.schools; track school._id) {
              <option [value]="school._id">{{ school.name }}</option>
            }
          </select>
        </label>
        <label>
          Assigned to
          <select class="adm-select" formControlName="assignee">
            <option value="">Nobody yet</option>
            @for (admin of context.admins; track admin._id) {
              <option [value]="admin._id">{{ admin.firstname }} {{ admin.lastname }}</option>
            }
          </select>
        </label>
        <label>
          Reported by <small class="ticket-optional">optional</small>
          <input class="adm-input" formControlName="reporterName" maxlength="120" placeholder="Name" />
        </label>
        <label>
          Their email <small class="ticket-optional">optional</small>
          <input
            class="adm-input"
            type="email"
            formControlName="reporterEmail"
            maxlength="200"
            placeholder="name@futo.edu.ng"
          />
        </label>
      </div>

      <div class="adm-dialog__actions">
        <button type="button" class="adm-btn adm-btn--outline" (click)="ref.close()">Cancel</button>
        <button type="submit" class="adm-btn" [disabled]="form.invalid || saving()">
          {{ saving() ? 'Saving…' : editing ? 'Save changes' : 'Create ticket' }}
        </button>
      </div>
    </form>
  `,
  styles: `
    .ticket-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      column-gap: 16px;
    }

    @media (max-width: 640px) {
      .ticket-grid {
        grid-template-columns: 1fr;
      }
    }

    .ticket-optional {
      font-weight: 400;
      color: #9ca3af;
    }
  `,
})
export class TicketFormDialog {
  readonly ref = inject(MatDialogRef<TicketFormDialog, ITicket | undefined>);
  readonly context = inject<ITicketFormContext>(MAT_DIALOG_DATA);
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);

  readonly editing = !!this.context.ticket;
  readonly categories = CATEGORY_ORDER;
  readonly categoryLabels = CATEGORY_LABELS;
  readonly priorities = PRIORITY_ORDER;
  readonly priorityLabels = PRIORITY_LABELS;
  readonly saving = signal(false);

  readonly form = new FormGroup({
    title: new FormControl(this.context.ticket?.title ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(140)],
    }),
    description: new FormControl(this.context.ticket?.description ?? '', { nonNullable: true }),
    category: new FormControl<TicketCategory>(this.context.ticket?.category ?? 'OTHER', {
      nonNullable: true,
    }),
    priority: new FormControl<TicketPriority>(this.context.ticket?.priority ?? 'NORMAL', {
      nonNullable: true,
    }),
    school: new FormControl(this.context.ticket?.school?._id ?? '', { nonNullable: true }),
    assignee: new FormControl(this.context.ticket?.assignee?._id ?? '', { nonNullable: true }),
    reporterName: new FormControl(this.context.ticket?.reporterName ?? '', { nonNullable: true }),
    reporterEmail: new FormControl(this.context.ticket?.reporterEmail ?? '', {
      nonNullable: true,
      validators: [Validators.email],
    }),
  });

  save(): void {
    if (this.form.invalid || this.saving()) return;
    const value = this.form.getRawValue();
    const body: ITicketForm = {
      title: value.title.trim(),
      description: value.description.trim(),
      category: value.category,
      priority: value.priority,
      school: value.school || null,
      assignee: value.assignee || null,
      reporterName: value.reporterName.trim() || null,
      reporterEmail: value.reporterEmail.trim() || null,
    };
    const ticket = this.context.ticket;
    const request = ticket ? this.api.updateTicket(ticket._id, body) : this.api.createTicket(body);
    this.saving.set(true);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (resp) => {
        this.toast.success(ticket ? 'Ticket updated.' : `${resp.data.reference} created.`);
        this.ref.close(resp.data);
      },
      error: (err) => this.toast.error(messageOf(err, 'Could not save the ticket.')),
    });
  }
}

/** Nest validation errors arrive as an array of messages. */
export function messageOf(err: unknown, fallback: string): string {
  const message = (err as { error?: { message?: unknown } })?.error?.message;
  if (Array.isArray(message)) return message.join(' ');
  return typeof message === 'string' && message ? message : fallback;
}
