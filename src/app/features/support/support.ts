import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';

import { Skeleton } from '../../shared/skeleton';
import { ToastService } from '../../core/services/toast.service';
import { ChatThread } from './chat-thread';
import {
  IConversationSummary,
  IMessage,
  IStreamEvent,
} from './messaging.model';
import { MessagingService } from './messaging.service';
import { listTimestamp } from './message-day';
import { readablePreview } from './readable-text';

/**
 * The support desk: every ticket raised from either portal, and the reply box.
 *
 * A queue rather than a mailbox. Any admin sees every thread — not only the
 * ones they have already touched — because a question that arrived while you
 * were on leave is still a question, and a helpdesk whose oldest tickets are
 * invisible to whoever is on duty is worse than no helpdesk. The server
 * enforces that: an admin listing conversations gets all SUPPORT rows, and
 * joins a thread the first time they open it so their own unread count and
 * read receipts start working.
 *
 * Replies go out as "Acheva Support", never under a personal name. The person
 * answering may change between two messages, and a user should not come to
 * expect whoever replied last time.
 */
@Component({
  selector: 'app-support',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, Skeleton, ChatThread],
  templateUrl: './support.html',
  styleUrl: './support.scss',
})
export class Support implements OnInit {
  private readonly messaging = inject(MessagingService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly tickets = signal<IConversationSummary[]>([]);
  readonly messages = signal<IMessage[]>([]);
  readonly active = signal<IConversationSummary | null>(null);
  readonly loadingQueue = signal(true);
  readonly loadingThread = signal(false);
  readonly search = signal('');
  /** Unanswered first, or just the newest? Defaults to what needs a reply. */
  readonly unansweredOnly = signal(false);

  readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const rows = this.unansweredOnly()
      ? this.tickets().filter((t) => t.unread > 0)
      : this.tickets();

    if (!term) return rows;
    return rows.filter(
      (t) =>
        (t.title ?? '').toLowerCase().includes(term) ||
        (t.subtitle ?? '').toLowerCase().includes(term) ||
        (t.lastMessage?.preview ?? '').toLowerCase().includes(term)
    );
  });

  readonly waiting = computed(
    () => this.tickets().filter((t) => t.unread > 0).length
  );

  ngOnInit(): void {
    this.loadQueue();

    this.messaging.start();
    this.messaging.stream$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.onStreamEvent(event));

    this.destroyRef.onDestroy(() => this.messaging.setActiveConversation(null));
  }

  private loadQueue(): void {
    this.messaging
      .inbox()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resp) => {
          this.tickets.set(
            resp.data.conversations.filter((c) => c.kind === 'SUPPORT')
          );
          this.loadingQueue.set(false);
        },
        error: () => this.loadingQueue.set(false),
      });
  }

  open(ticket: IConversationSummary): void {
    this.active.set(ticket);
    this.messaging.setActiveConversation(ticket.id);
    this.loadingThread.set(true);
    this.messages.set([]);

    this.messaging
      .thread(ticket.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resp) => {
          this.messages.set([...resp.data.messages].reverse());
          this.loadingThread.set(false);
        },
        error: () => this.loadingThread.set(false),
      });

    if (ticket.unread > 0) this.clearUnread(ticket.id);
  }

  private clearUnread(conversationId: string): void {
    this.tickets.update((rows) =>
      rows.map((row) => (row.id === conversationId ? { ...row, unread: 0 } : row))
    );
    this.messaging
      .markRead(conversationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => undefined });
  }

  send(body: string): void {
    const ticket = this.active();
    if (!body || !ticket) return;

    const localId = `pending-${Date.now()}`;
    this.messages.update((rows) => [
      ...rows,
      {
        id: localId,
        body,
        kind: 'TEXT',
        sender: null,
        mine: true,
        createdAt: new Date().toISOString(),
        pending: true,
        read: false,
      },
    ]);

    this.messaging
      .send(ticket.id, body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resp) => {
          this.messages.update((rows) =>
            rows.map((row) => (row.id === localId ? resp.data : row))
          );
          this.bump(ticket.id, body);
        },
        error: () => {
          this.messages.update((rows) =>
            rows.map((row) =>
              row.id === localId ? { ...row, pending: false, failed: true } : row
            )
          );
          this.toast.error('That reply did not send. Check your connection.');
        },
      });
  }

  private bump(conversationId: string, preview: string): void {
    this.tickets.update((rows) => {
      const found = rows.find((row) => row.id === conversationId);
      if (!found) return rows;
      const updated: IConversationSummary = {
        ...found,
        lastMessage: {
          preview,
          at: new Date().toISOString(),
          sender: null,
          mine: true,
          read: false,
        },
        updatedAt: new Date().toISOString(),
      };
      return [updated, ...rows.filter((row) => row.id !== conversationId)];
    });
  }

  private onStreamEvent(event: IStreamEvent): void {
    if (event.type === 'conversation:new') {
      this.loadQueue();
      return;
    }

    if (event.type === 'message:read') {
      this.applyReadReceipt(event);
      return;
    }

    if (event.type !== 'message:new') return;

    const { conversationId, body, preview } = event.payload;

    if (this.active()?.id === conversationId) {
      this.messages.update((rows) => [
        ...rows,
        {
          id: event.payload.messageId ?? `live-${Date.now()}`,
          body: body ?? preview ?? '',
          kind: 'TEXT',
          sender: event.payload.sender ?? null,
          mine: false,
          createdAt: event.payload.createdAt ?? new Date().toISOString(),
        },
      ]);
      this.clearUnread(conversationId);
      return;
    }

    // A ticket this session has not seen is a NEW one — refetch rather than
    // invent a row, so it arrives with the requester's real name attached.
    const known = this.tickets().some((t) => t.id === conversationId);
    if (!known) {
      this.loadQueue();
      return;
    }

    this.tickets.update((rows) => {
      const found = rows.find((row) => row.id === conversationId);
      if (!found) return rows;
      const updated: IConversationSummary = {
        ...found,
        unread: found.unread + 1,
        lastMessage: {
          preview: body ?? preview ?? '',
          at: new Date().toISOString(),
          sender: event.payload.sender ?? null,
          mine: false,
          read: false,
        },
        updatedAt: new Date().toISOString(),
      };
      return [updated, ...rows.filter((row) => row.id !== conversationId)];
    });
  }

  private applyReadReceipt(event: IStreamEvent): void {
    const { conversationId } = event.payload;
    const readAt = new Date(event.payload.at ?? Date.now()).getTime();

    if (this.active()?.id === conversationId) {
      this.messages.update((rows) =>
        rows.map((row) =>
          row.mine && !row.read && new Date(row.createdAt).getTime() <= readAt
            ? { ...row, read: true }
            : row
        )
      );
    }
  }

  initials(ticket: IConversationSummary): string {
    return (ticket.title ?? '?')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  /** A preview safe to print — never raw ciphertext. See `readable-text.ts`. */
  previewOf(conversation: IConversationSummary): string {
    return readablePreview(conversation.lastMessage?.preview);
  }

  /** Time for today's tickets, a day for anything older. */
  stampFor(ticket: IConversationSummary): string {
    return listTimestamp(ticket.lastMessage?.at);
  }

  trackById = (_: number, item: { id: string }) => item.id;
}
