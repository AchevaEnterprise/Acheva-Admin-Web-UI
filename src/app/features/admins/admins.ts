import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogRef,
} from '@angular/material/dialog';
import {
  IAdminInvite,
  IAdminProfile,
  ICreatedInvite,
} from '../../core/models/admin.model';
import { AdminApiService } from '../../core/services/admin-api.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmDialog, IConfirmData } from '../../shared/confirm-dialog';

// ─── Invite dialog: email in → copyable link out ────────────────────────────

@Component({
  selector: 'app-invite-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <div class="adm-dialog">
      <h2>Invite Admin</h2>
      @if (!created()) {
        <p>
          Registration is invite-only. The invite is emailed and you also get
          a link to share directly. It expires in 7 days.
        </p>
        <label>
          Email
          <input class="adm-input" [formControl]="email" placeholder="colleague@acheva.app" />
        </label>
        <div class="adm-dialog__actions">
          <button type="button" class="adm-btn adm-btn--outline" (click)="ref.close(false)">Cancel</button>
          <button type="button" class="adm-btn" [disabled]="email.invalid || sending()" (click)="send()">
            {{ sending() ? 'Creating…' : 'Create invite' }}
          </button>
        </div>
      } @else {
        <p>Invite created for <strong>{{ created()!.email }}</strong>. Share this link:</p>
        <div class="invite-link">
          <code>{{ created()!.inviteLink }}</code>
        </div>
        <div class="adm-dialog__actions">
          <button type="button" class="adm-btn adm-btn--outline" (click)="copy()">
            {{ copied() ? 'Copied ✓' : 'Copy link' }}
          </button>
          <button type="button" class="adm-btn" (click)="ref.close(true)">Done</button>
        </div>
      }
    </div>
  `,
  styles: `
    .invite-link {
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      margin-top: 12px;
      word-break: break-all;
      font-size: 0.75rem;
    }
  `,
})
export class InviteDialog {
  readonly ref = inject(MatDialogRef<InviteDialog, boolean>);
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  readonly initialEmail = inject<string | null>(MAT_DIALOG_DATA);

  email = new FormControl(this.initialEmail ?? '', {
    nonNullable: true,
    validators: [Validators.required, Validators.email],
  });
  sending = signal(false);
  created = signal<ICreatedInvite | null>(null);
  copied = signal(false);

  send(): void {
    if (this.email.invalid) return;
    this.sending.set(true);
    this.api.createInvite(this.email.value).subscribe({
      next: (resp) => {
        this.sending.set(false);
        this.created.set(resp.data);
      },
      error: (err) => {
        this.sending.set(false);
        this.toast.error(err?.error?.message ?? 'Could not create the invite.');
      },
    });
  }

  copy(): void {
    const link = this.created()?.inviteLink;
    if (!link) return;
    void navigator.clipboard.writeText(link).then(() => this.copied.set(true));
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-admins',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  templateUrl: './admins.html',
})
export class Admins implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);

  admins = signal<IAdminProfile[]>([]);
  invites = signal<IAdminInvite[]>([]);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.admins().subscribe({ next: (resp) => this.admins.set(resp.data ?? []) });
    this.api.invites().subscribe({ next: (resp) => this.invites.set(resp.data ?? []) });
  }

  invite(): void {
    this.dialog
      .open(InviteDialog, { data: null })
      .afterClosed()
      .subscribe(() => this.load());
  }

  revoke(invite: IAdminInvite): void {
    const data: IConfirmData = {
      title: 'Revoke this invite?',
      message: `${invite.email} will no longer be able to register with it.`,
      confirmLabel: 'Revoke',
      destructive: true,
    };
    this.dialog
      .open(ConfirmDialog, { data })
      .afterClosed()
      .subscribe((confirmed: boolean) => {
        if (!confirmed) return;
        this.api.revokeInvite(invite._id).subscribe({
          next: () => {
            this.toast.success('Invite revoked.');
            this.load();
          },
          error: (err) =>
            this.toast.error(err?.error?.message ?? 'Could not revoke.'),
        });
      });
  }
}
