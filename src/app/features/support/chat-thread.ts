import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';

import { Skeleton } from '../../shared/skeleton';
import { IConversationSummary, IMessage } from './messaging.model';
import { MessageTicks, TickState } from './message-ticks';
import { groupMessagesByDay } from './message-day';
import { readableText } from './readable-text';

/**
 * One open conversation: who it is with, the bubbles, and the box you type in.
 *
 * Extracted from the messages page because the support desk needs exactly the
 * same thing with no thread list beside it. Everything about how a message
 * looks — bubble side, ticks, the bottom-anchoring, Enter to send — lives here
 * once, so a chat cannot start behaving differently depending on which page it
 * is on.
 *
 * Deliberately dumb: it renders what it is given and reports what was typed.
 * Sending, optimistic state and the live stream stay with the page that owns
 * the conversation.
 */
@Component({
  selector: 'app-chat-thread',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    Skeleton,
    MessageTicks,
  ],
  templateUrl: './chat-thread.html',
  styleUrl: './chat-thread.scss',
})
export class ChatThread {
  readonly conversation = input<IConversationSummary | null>(null);
  readonly messages = input<readonly IMessage[]>([]);
  readonly loading = input<boolean>(false);
  /** Hides the header when the page already says who you are talking to. */
  readonly showHeader = input<boolean>(true);
  readonly placeholder = input<string>('Type a message');

  readonly sendMessage = output<string>();

  readonly draft = signal('');

  /** The thread split into days, so a separator sits above each day's first. */
  readonly days = computed(() => groupMessagesByDay(this.messages()));

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  constructor() {
    // Follow the conversation down as it grows, and land at the bottom when a
    // different thread is opened. Reading `messages()` is what subscribes this
    // to both.
    effect(() => {
      this.messages();
      this.scrollToLatest();
    });
  }

  submit(): void {
    const body = this.draft().trim();
    if (!body) return;
    this.draft.set('');
    this.sendMessage.emit(body);
  }

  onDraftKey(event: KeyboardEvent): void {
    // Enter sends, Shift+Enter breaks the line — the convention everyone
    // already has in their fingers.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.submit();
    }
  }

  /** None while in flight or failed, one once sent, two once read. */
  tickFor(message: IMessage): TickState {
    if (!message.mine || message.pending || message.failed) return 'none';
    return message.read ? 'read' : 'sent';
  }

  initials(conversation: IConversationSummary): string {
    if (conversation.kind === 'ANNOUNCEMENT') return '📣';
    return (conversation.title ?? '?')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  /**
   * A body safe to print. Normally the text unchanged — but an API serving
   * ciphertext (a stale deploy, a missing key) must never reach the screen as
   * base64. See `readable-text.ts`.
   */
  bodyOf(message: IMessage): string {
    return readableText(message.body);
  }

  trackById = (_: number, item: { id: string }) => item.id;
  trackByDay = (_: number, item: { key: string }) => item.key;

  private scrollToLatest(): void {
    // After the next paint, or the new bubble is not yet laid out.
    requestAnimationFrame(() => {
      const el = this.scroller()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
}
