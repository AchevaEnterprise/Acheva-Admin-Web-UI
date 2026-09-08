import { HttpClient } from '@angular/common/http';
import {
  DestroyRef,
  Injectable,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Observable, Subject, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import {
  IAPIResponse,
  IConversationPage,
  IInboxPage,
  IMessage,
  IStreamEvent,
} from './messaging.model';

/** Backoff between reconnect attempts, in ms. Caps rather than growing forever. */
const RECONNECT_STEPS = [1000, 2000, 5000, 10000, 20000];

@Injectable({ providedIn: 'root' })
export class MessagingService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly baseUrl = `${environment.BASE_URL}/messaging`;

  /** Whether the live stream is currently connected — drives the UI dot. */
  readonly live = signal(false);

  /**
   * Everything the server pushes, for anyone who wants it.
   *
   * The stream is owned HERE rather than by the messages page, because a chat
   * that is only live while you are looking at it is not live. The sidebar
   * badge has to move while you are on the dashboard, and a message that
   * arrives on another page must already be in hand when you navigate over.
   */
  private readonly events = new Subject<IStreamEvent>();
  readonly stream$ = this.events.asObservable();

  /** Open tickets waiting on the desk. */
  readonly unreadTotal = signal(0);

  private static readonly badgeLabel = (n: number): string =>
    n <= 0 ? '' : n > 99 ? '99+' : String(n);

  readonly unreadLabel = computed(() =>
    MessagingService.badgeLabel(this.unreadTotal())
  );

  /**
   * The thread currently on screen, if any.
   *
   * The page tells the service, so the badge does not count a message you are
   * watching arrive. Without it, opening a conversation and reading it live
   * still leaves a number in the sidebar.
   */
  private activeConversationId: string | null = null;

  private abort: AbortController | null = null;
  private attempt = 0;
  private started = false;

  constructor() {
    this.destroyRef.onDestroy(() => this.stop());
  }

  // ── The app-wide connection ───────────────────────────────────────────────

  /** Start the stream and seed the badge. Idempotent — the shell calls it. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.refreshUnread();
    this.connect((event) => this.events.next(event));
  }

  /** Tear down on sign-out, so the next session does not inherit a count. */
  stop(): void {
    this.started = false;
    this.activeConversationId = null;
    this.unreadTotal.set(0);
    this.disconnect();
  }

  setActiveConversation(conversationId: string | null): void {
    this.activeConversationId = conversationId;
  }

  /** Recount from the server. The inbox already carries each row's unread. */
  refreshUnread(): void {
    this.inbox().subscribe({
      next: (resp) => {
        const rows = resp.data.conversations;
        // Two badges, two counts: Messages counts people at your institution,
        // Support counts the desk. A support reply lighting up the Messages
        // badge would send you to a page the thread is not on.
        this.unreadTotal.set(
          rows.reduce((sum, row) => sum + row.unread, 0)
        );
      },
      error: () => undefined,
    });
  }

  // ── REST ──────────────────────────────────────────────────────────────────

  /** Who I can start a conversation with — already permission-filtered. */

  inbox(cursor?: string): Observable<IAPIResponse<IInboxPage>> {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return this.http.get<IAPIResponse<IInboxPage>>(
      `${this.baseUrl}/conversations${query}`
    );
  }

  thread(
    conversationId: string,
    cursor?: string
  ): Observable<IAPIResponse<IConversationPage>> {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return this.http.get<IAPIResponse<IConversationPage>>(
      `${this.baseUrl}/conversations/${conversationId}/messages${query}`
    );
  }

  /**
   * My thread with the Acheva support desk, created on first contact.
   *
   * Takes no argument because there is nobody to choose: everyone has exactly
   * one support thread, and the desk is the only counterpart.
   */


  send(
    conversationId: string,
    body: string
  ): Observable<IAPIResponse<IMessage>> {
    return this.http.post<IAPIResponse<IMessage>>(
      `${this.baseUrl}/conversations/${conversationId}/messages`,
      { body }
    );
  }

  markRead(conversationId: string): Observable<IAPIResponse<unknown>> {
    return this.http
      .patch<
        IAPIResponse<unknown>
      >(`${this.baseUrl}/conversations/${conversationId}/read`, {})
      .pipe(tap(() => this.refreshUnread()));
  }


  // ── The live stream ───────────────────────────────────────────────────────

  /**
   * Subscribe to server-sent events.
   *
   * `fetch` with a streamed body rather than the native `EventSource`, for one
   * reason: `EventSource` cannot set an `Authorization` header, and this app
   * authenticates with a bearer token. The alternatives were putting the token
   * in the query string — where it lands in access logs and browser history —
   * or minting a second token type purely for streaming. Reading the stream by
   * hand costs about forty lines and avoids both.
   *
   * The trade is that reconnection is ours to do rather than the browser's,
   * which is what the backoff below is. A dropped stream costs freshness and
   * never data: REST remains the source of truth, so the next fetch repairs
   * whatever was missed while it was down.
   */
  connect(onEvent: (event: IStreamEvent) => void): void {
    this.disconnect();
    void this.streamLoop(onEvent);
  }

  disconnect(): void {
    this.abort?.abort();
    this.abort = null;
    this.live.set(false);
  }

  private async streamLoop(
    onEvent: (event: IStreamEvent) => void
  ): Promise<void> {
    const controller = new AbortController();
    this.abort = controller;

    try {
      const response = await fetch(`${this.baseUrl}/stream`, {
        headers: {
          Authorization: `Bearer ${this.auth.token ?? ''}`,
          Accept: 'text/event-stream',
        },
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Stream refused with ${response.status}`);
      }

      this.live.set(true);
      this.attempt = 0;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by a blank line. Anything after the last
        // separator is a partial frame and stays in the buffer for next time —
        // a chunk boundary can land mid-JSON.
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';

        for (const frame of frames) {
          const parsed = this.parseFrame(frame);
          if (!parsed) continue;
          this.countTowardsBadge(parsed);
          onEvent(parsed);
        }
      }
    } catch {
      // Any failure is the same failure: the stream is down and we try again.
    }

    this.live.set(false);

    // Only reconnect if this loop was not deliberately cancelled.
    if (controller.signal.aborted) return;

    const wait =
      RECONNECT_STEPS[Math.min(this.attempt, RECONNECT_STEPS.length - 1)];
    this.attempt += 1;
    setTimeout(() => {
      if (!controller.signal.aborted) void this.streamLoop(onEvent);
    }, wait);
  }

  /**
   * Move the sidebar badge as events land.
   *
   * Counted here rather than in the page, because the whole point is that it
   * keeps counting while the messages page is nowhere on screen. A message in
   * the thread you are already reading is not unread, which is what
   * `activeConversationId` is for.
   */
  private countTowardsBadge(event: IStreamEvent): void {
    if (event.type === 'conversation:new') {
      this.refreshUnread();
      return;
    }

    if (event.type !== 'message:new') return;

    if (event.payload.conversationId === this.activeConversationId) return;

    this.unreadTotal.update((n) => n + 1);
  }

  /**
   * One `event:`/`data:` frame into a typed event, or null if unusable.
   *
   * The event name is read from the JSON BODY first and only falls back to the
   * `event:` line. That order is deliberate and was bought the hard way: the
   * global response interceptor used to wrap every SSE emission, which
   * stripped the `event:` line off every frame. This parser required that line
   * and so discarded all of them — the stream connected, the server published,
   * and the UI stayed frozen until a reload. Both ends now carry the name, and
   * either one alone is enough to keep messaging live.
   */
  private parseFrame(frame: string): IStreamEvent | null {
    let lineType = '';
    const dataLines: string[] = [];

    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) lineType = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }

    if (dataLines.length === 0) return null;

    try {
      // `JSON.parse` is `any` by definition — the frame came off a socket and
      // nothing about it is known until it is read. Narrowed here rather than
      // let loose into the component.
      const body = JSON.parse(dataLines.join('\n')) as Partial<IStreamEvent> & {
        payload?: IStreamEvent['payload'];
      };

      const type = (body?.type ?? lineType) as IStreamEvent['type'];
      // Self-describing body (`{ type, payload }`), or a bare payload beside
      // an `event:` line. Nothing else is a frame this app sent.
      const payload = (body?.payload ??
        (body as unknown as IStreamEvent['payload'])) as IStreamEvent['payload'];

      if (!type || !payload?.conversationId) return null;

      return { type, payload };
    } catch {
      // A malformed frame is dropped rather than killing the stream.
      return null;
    }
  }
}
