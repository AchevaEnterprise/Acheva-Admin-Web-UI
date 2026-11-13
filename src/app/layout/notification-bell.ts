import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval, startWith, switchMap } from 'rxjs';

import { IAdminNotification } from '../core/models/admin.model';
import { AdminApiService } from '../core/services/admin-api.service';

/** How often the bell looks for new notices. */
const POLL_MS = 60_000;

/**
 * The header bell (2026-11-11). It used to be a decorative emoji; now it is
 * where Acheva is told things — first of all, a Head changing their
 * department's dues total, which every admin is notified of.
 *
 * Polled rather than streamed: notices here arrive a few times a week, and the
 * messaging SSE stream is the support desk's.
 */
@Component({
  selector: 'app-notification-bell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="bell"
      [attr.aria-label]="unread() ? unread() + ' unread notifications' : 'Notifications'"
      [attr.aria-expanded]="open()"
      (click)="toggle()"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      @if (unread()) {
        <span class="bell__count">{{ unread() > 9 ? '9+' : unread() }}</span>
      }
    </button>

    @if (open()) {
      <div class="panel" role="dialog" aria-label="Notifications">
        <header class="panel__head">
          <span class="panel__title">Notifications</span>
          @if (unread()) {
            <button type="button" class="panel__link" (click)="markAll()">Mark all read</button>
          }
        </header>
        @if (items().length === 0) {
          <p class="panel__empty">Nothing yet. You will be told here when a Head changes their dues.</p>
        } @else {
          <ul class="panel__list">
            @for (item of items(); track item._id) {
              <li>
                <button
                  type="button"
                  class="item"
                  [class.item--unread]="item.status === 'UNREAD'"
                  (click)="read(item)"
                >
                  <span class="item__title">{{ item.title }}</span>
                  <span class="item__message">{{ item.message }}</span>
                  <span class="item__date">{{ date(item.createdAt) }}</span>
                </button>
              </li>
            }
          </ul>
        }
      </div>
    }
  `,
  styles: `
    :host { position: relative; display: inline-flex; }
    .bell {
      position: relative;
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border: none;
      border-radius: 50%;
      background: transparent;
      color: #4b5563;
      cursor: pointer;
    }
    .bell:hover { background: rgb(119 187 255 / 15%); color: #2793ff; }
    .bell__count {
      position: absolute;
      top: 2px;
      right: 0;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      border-radius: 999px;
      background: #2793ff;
      color: #fff;
      font-size: 0.6875rem;
      font-weight: 500;
      line-height: 18px;
      text-align: center;
    }
    .panel {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      z-index: 20;
      width: min(380px, calc(100vw - 32px));
      max-height: 70vh;
      overflow-y: auto;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgb(0 0 0 / 10%);
    }
    .panel__head {
      position: sticky;
      top: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      background: #fff;
      border-bottom: 1px solid #e5e7eb;
    }
    .panel__title { font-size: 0.9375rem; font-weight: 500; color: #1f2937; }
    .panel__link {
      border: none;
      background: none;
      color: #2793ff;
      font: inherit;
      font-size: 0.8125rem;
      font-weight: 500;
      cursor: pointer;
    }
    .panel__empty { margin: 0; padding: 24px 16px; color: #6b7280; font-size: 0.8125rem; }
    .panel__list { margin: 0; padding: 0; list-style: none; }
    .item {
      display: flex;
      flex-direction: column;
      gap: 4px;
      width: 100%;
      padding: 12px 16px;
      border: none;
      border-bottom: 1px solid #f3f4f6;
      background: #fff;
      text-align: left;
      font: inherit;
      cursor: pointer;
    }
    .item:hover { background: #f9fafb; }
    .item--unread { background: rgb(119 187 255 / 10%); }
    .item--unread .item__title::before {
      content: '';
      display: inline-block;
      width: 8px;
      height: 8px;
      margin-right: 8px;
      border-radius: 50%;
      background: #2793ff;
      vertical-align: middle;
    }
    .item__title { font-size: 0.875rem; font-weight: 500; color: #1f2937; }
    .item__message { font-size: 0.8125rem; line-height: 1.45; color: #4b5563; }
    .item__date { font-size: 0.75rem; color: #9ca3af; }
  `,
})
export class NotificationBell {
  private readonly api = inject(AdminApiService);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly items = signal<IAdminNotification[]>([]);
  readonly open = signal(false);
  readonly unread = computed(() => this.items().filter((item) => item.status === 'UNREAD').length);

  constructor() {
    interval(POLL_MS)
      .pipe(
        startWith(0),
        switchMap(() => this.api.notifications()),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe({ next: (resp) => this.items.set(resp.data ?? []) });
  }

  toggle(): void {
    this.open.update((open) => !open);
    if (this.open()) {
      this.api.notifications().subscribe({ next: (resp) => this.items.set(resp.data ?? []) });
    }
  }

  read(item: IAdminNotification): void {
    if (item.status === 'READ') return;
    this.items.update((items) =>
      items.map((each) => (each._id === item._id ? { ...each, status: 'READ' } : each)),
    );
    this.api.markNotificationRead(item._id).subscribe();
  }

  markAll(): void {
    this.items.update((items) => items.map((item) => ({ ...item, status: 'READ' as const })));
    this.api.markAllNotificationsRead().subscribe();
  }

  /** "11/11/2026, 12:40" — day first. */
  date(value: string): string {
    const d = new Date(value);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  @HostListener('document:click', ['$event'])
  closeOnOutsideClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    this.open.set(false);
  }
}
