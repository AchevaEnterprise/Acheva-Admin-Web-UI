import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import {
  ICreatedManagementInvite,
  IManagementAccountRow,
  IManagementInviteRow,
  ISchool,
  ManagementOffice,
} from '../../core/models/admin.model';
import { AdminApiService } from '../../core/services/admin-api.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmDialog, IConfirmData } from '../../shared/confirm-dialog';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const messageOf = (err: unknown, fallback: string): string => {
  const message = (err as { error?: { message?: unknown } })?.error?.message;
  if (Array.isArray(message)) return String(message[0]);
  return typeof message === 'string' ? message : fallback;
};

interface IOfficeCard {
  readonly office: ManagementOffice;
  readonly title: string;
  readonly hint: string;
}

const OFFICES: readonly IOfficeCard[] = [
  {
    office: 'DVC',
    title: 'DVC',
    hint: 'One per university. Vets and approves the result sheets the Deans send.',
  },
  {
    office: 'EXAMS_RECORDS',
    title: 'Head of Exams & Records',
    hint: 'Files the approved sheets, and adds the rest of the Exams & Records team.',
  },
];

/**
 * Acheva appoints each university's DVC and head of Exams & Records
 * (the user, 2026-11-13). They sign in at management.acheva.app; the head
 * then adds their own team, which shows here too.
 */
@Component({
  selector: 'app-management',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="adm-page-head">
      <div>
        <h2 class="acva-heading-5 fw-500 m-0">Management</h2>
        <p class="acva-para-1 text-neutral-500 m-0">
          The DVC and Exams &amp; Records sign in at management.acheva.app. Appoint each university's DVC and
          head of Exams &amp; Records here; the head adds the rest of the team.
        </p>
      </div>
      <label class="mgmt-school">
        <span class="acva-caption text-neutral-500">University</span>
        <select class="adm-input" [value]="school()" (change)="pickSchool($any($event.target).value)" aria-label="University">
          @for (each of schools(); track each._id) {
            <option [value]="each._id">{{ each.name }}</option>
          }
        </select>
      </label>
    </div>

    @if (created(); as created) {
      <section class="adm-card mgmt-created">
        <p class="m-0">
          Invite sent to {{ created.email }} as {{ created.officeTitle }}. If the email does not arrive, share this link —
          it works for 7 days:
        </p>
        <div class="mgmt-link">
          <code>{{ created.inviteLink }}</code>
          <button type="button" class="adm-btn adm-btn--outline" (click)="copy(created.inviteLink)">Copy link</button>
        </div>
      </section>
    }

    <div class="mgmt-offices">
      @for (card of offices; track card.office) {
        @let holder = holderOf(card.office);
        <section class="adm-card mgmt-office">
          <h3 class="acva-para-2 fw-500 m-0">{{ card.title }}</h3>
          <p class="acva-caption text-neutral-500 m-0">{{ card.hint }}</p>
          @if (holder) {
            <div class="mgmt-holder">
              <div>
                <p class="m-0 fw-500">{{ nameOf(holder) }}</p>
                <p class="acva-caption text-neutral-500 m-0">{{ holder.email }}</p>
              </div>
              <button type="button" class="adm-btn adm-btn--outline" (click)="setActive(holder, false)">Deactivate</button>
            </div>
          } @else {
            @let pending = pendingFor(card.office);
            @if (pending) {
              <p class="acva-caption m-0">Invited {{ pending.email }} — not yet accepted.</p>
            }
            <form class="mgmt-invite" (submit)="$event.preventDefault(); invite(card.office)">
              <input
                class="adm-input"
                type="email"
                [placeholder]="card.office === 'DVC' ? 'dvc@futo.edu.ng' : 'exams.records@futo.edu.ng'"
                [value]="emails()[card.office]"
                (input)="setEmail(card.office, $any($event.target).value)"
                [attr.aria-label]="card.title + ' email'"
              />
              <button type="submit" class="adm-btn" [disabled]="sending() || loading() || !school() || !valid(card.office)">
                {{ pending ? 'Invite again' : 'Send invite' }}
              </button>
            </form>
          }
        </section>
      }
    </div>

    <section class="adm-card mb-6">
      <h3 class="acva-para-2 fw-500 m-0 mb-3">Everyone with a management account</h3>
      @if (loading()) {
        <p class="adm-empty">Loading…</p>
      } @else if (!accounts().length) {
        <p class="adm-empty">Nobody yet. Invite the DVC and the head of Exams &amp; Records above.</p>
      } @else {
        <table class="adm-table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Office</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            @for (account of accounts(); track account._id) {
              <tr>
                <td>{{ nameOf(account) }}</td>
                <td>{{ account.email }}</td>
                <td>{{ account.officeTitle }}</td>
                <td>
                  <span class="adm-chip" [class.adm-chip--brand]="account.isActive" [class.adm-chip--muted]="!account.isActive">
                    {{ account.isActive ? 'Active' : 'Deactivated' }}
                  </span>
                </td>
                <td class="mgmt-right">
                  <button type="button" class="adm-link-btn" (click)="setActive(account, !account.isActive)">
                    {{ account.isActive ? 'Deactivate' : 'Reactivate' }}
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </section>

    @if (invites().length) {
      <section class="adm-card">
        <h3 class="acva-para-2 fw-500 m-0 mb-3">Invites not yet accepted</h3>
        <table class="adm-table">
          <thead>
            <tr><th>Email</th><th>Office</th><th>Expires</th><th></th></tr>
          </thead>
          <tbody>
            @for (pending of invites(); track pending._id) {
              <tr>
                <td>{{ pending.email }}</td>
                <td>{{ pending.officeTitle }}</td>
                <td>{{ date(pending.expiresAt) }}</td>
                <td class="mgmt-right">
                  <button type="button" class="adm-link-btn" (click)="revoke(pending)">Withdraw</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </section>
    }
  `,
  styles: `
    .mgmt-school { display: flex; flex-direction: column; gap: 6px; min-width: 280px; }
    .mgmt-offices { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .mgmt-office { display: flex; flex-direction: column; gap: 12px; }
    .mgmt-holder { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px; border-radius: 8px; background: rgb(119 187 255 / 12%); }
    .mgmt-invite { display: flex; gap: 8px; }
    .mgmt-invite input { flex: 1; }
    .mgmt-created { margin-bottom: 16px; display: flex; flex-direction: column; gap: 12px; }
    .mgmt-link { display: flex; align-items: center; gap: 12px; }
    .mgmt-link code { flex: 1; padding: 10px; border-radius: 8px; background: #f3f4f6; word-break: break-all; }
    .mgmt-right { text-align: right; }
    /* New UI keeps to weight 500; the console's shared button and header are 600. */
    .adm-btn,
    .adm-table th { font-weight: 500; }
  `,
})
export class Management {
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);

  readonly offices = OFFICES;
  readonly schools = signal<ISchool[]>([]);
  readonly school = signal('');
  readonly accounts = signal<IManagementAccountRow[]>([]);
  readonly invites = signal<IManagementInviteRow[]>([]);
  readonly loading = signal(true);
  readonly sending = signal(false);
  readonly created = signal<ICreatedManagementInvite | null>(null);
  readonly emails = signal<Record<ManagementOffice, string>>({ DVC: '', EXAMS_RECORDS: '' });

  readonly active = computed(() => this.accounts().filter((account) => account.isActive));

  constructor() {
    this.api.schools().subscribe({
      next: (resp) => {
        const schools = resp.data ?? [];
        this.schools.set(schools);
        const futo = schools.find((each) => each.acronym === 'FUTO') ?? schools[0];
        if (futo) this.pickSchool(futo._id);
        else this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  holderOf(office: ManagementOffice): IManagementAccountRow | null {
    return (
      this.active().find(
        (account) => account.office === office && (office === 'DVC' || account.isTeamHead),
      ) ?? null
    );
  }

  pendingFor(office: ManagementOffice): IManagementInviteRow | null {
    return this.invites().find((invite) => invite.office === office && (office === 'DVC' || invite.isTeamHead)) ?? null;
  }

  nameOf(account: IManagementAccountRow): string {
    return [account.titles?.[0], account.firstname, account.lastname].filter(Boolean).join(' ');
  }

  setEmail(office: ManagementOffice, value: string): void {
    this.emails.update((emails) => ({ ...emails, [office]: value }));
  }

  valid(office: ManagementOffice): boolean {
    return EMAIL.test(this.emails()[office].trim());
  }

  pickSchool(id: string): void {
    this.school.set(id);
    this.created.set(null);
    this.load();
  }

  invite(office: ManagementOffice): void {
    if (!this.valid(office)) return;
    this.sending.set(true);
    this.api
      .inviteManagement({ school: this.school(), office, email: this.emails()[office].trim().toLowerCase() })
      .subscribe({
        next: (resp) => {
          this.sending.set(false);
          this.created.set(resp.data);
          this.setEmail(office, '');
          this.load();
        },
        error: (err) => {
          this.sending.set(false);
          this.toast.error(messageOf(err, 'The invite could not be sent.'));
        },
      });
  }

  setActive(account: IManagementAccountRow, active: boolean): void {
    const data: IConfirmData = active
      ? {
          title: `Reactivate ${this.nameOf(account)}?`,
          message: `They can sign in again as ${account.officeTitle}.`,
          confirmLabel: 'Reactivate',
        }
      : {
          title: `Deactivate ${this.nameOf(account)}?`,
          message: `They are signed out at once. Everything they approved or filed stays on record, and you can then invite their successor.`,
          confirmLabel: 'Deactivate',
        };
    this.dialog
      .open(ConfirmDialog, { data })
      .afterClosed()
      .subscribe((yes: boolean) => {
        if (!yes) return;
        this.api.setManagementActive(account._id, active).subscribe({
          next: () => {
            this.toast.success(active ? 'Reactivated.' : 'Deactivated.');
            this.load();
          },
          error: (err) => this.toast.error(messageOf(err, 'That did not go through.')),
        });
      });
  }

  revoke(invite: IManagementInviteRow): void {
    this.api.revokeManagementInvite(invite._id).subscribe({
      next: () => {
        this.toast.success('Invite withdrawn.');
        this.load();
      },
      error: (err) => this.toast.error(messageOf(err, 'The invite could not be withdrawn.')),
    });
  }

  copy(link: string): void {
    navigator.clipboard?.writeText(link).then(
      () => this.toast.success('Link copied.'),
      () => this.toast.error('Copy did not work — select the link and copy it.'),
    );
  }

  /** "20/11/2026" — day first. */
  date(value: string): string {
    const d = new Date(value);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }

  private load(): void {
    if (!this.school()) return;
    this.loading.set(true);
    this.api.managementAccounts(this.school()).subscribe({
      next: (resp) => {
        this.accounts.set(resp.data?.accounts ?? []);
        this.invites.set(resp.data?.invites ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.accounts.set([]);
        this.invites.set([]);
        this.loading.set(false);
      },
    });
  }
}
