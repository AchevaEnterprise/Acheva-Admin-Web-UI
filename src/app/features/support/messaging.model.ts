/**
 * The messaging contract, as the support desk needs it
 * (`acheva-nestjs/src/messaging/`). A hand-kept copy of the same file in both
 * portals — the three repos share no package.
 *
 * An admin only ever sees SUPPORT threads, but the shapes are identical
 * because the desk runs on the same conversation machine as everything else;
 * the difference is entirely in who may read which rows.
 */

export type ConversationKind =
  | 'DIRECT'
  | 'ADVISORY'
  | 'ANNOUNCEMENT'
  /** You ↔ the Acheva support desk. Lives on `/support`, not in Messages. */
  | 'SUPPORT';
export type RecipientClass = 'STAFF' | 'STUDENTS' | 'EVERYONE';

export interface ILastMessage {
  readonly preview: string | null;
  readonly at: string | null;
  readonly sender: string | null;
  /** Whether I wrote it — decides if the inbox row carries a tick at all. */
  readonly mine?: boolean;
  /** Whether the other side has read it. Always false on an announcement. */
  readonly read?: boolean;
}

/** One row of the inbox. Deliberately small — no participants array. */
export interface IConversationSummary {
  readonly id: string;
  readonly kind: ConversationKind;
  /** The other person's name, or the announcement's subject. */
  readonly title: string | null;
  /** Their office, or a registration number — enough to tell namesakes apart. */
  readonly subtitle: string | null;
  readonly subject: string | null;
  /** "All staff in the department" — announcements only. */
  readonly audienceLabel: string | null;
  readonly repliesDisabled: boolean;
  readonly lastMessage: ILastMessage | null;
  readonly unread: number;
  readonly mutedUntil: string | null;
  readonly updatedAt: string;
}

export interface IMessage {
  readonly id: string;
  readonly body: string | null;
  readonly kind: 'TEXT' | 'SYSTEM';
  readonly sender: string | null;
  readonly mine: boolean;
  readonly createdAt: string;
  /**
   * Whether the other side has read it. Only ever set on my own messages —
   * a receipt on somebody else's message would tell them what they know.
   *
   * The server derives it from when the counterpart last opened the thread,
   * so it is one field rather than a per-message read log.
   */
  readonly read?: boolean;
  /**
   * Local-only. A message typed but not yet acknowledged by the server shows
   * immediately with a clock, exactly as WhatsApp does — the alternative is a
   * keyboard that feels broken every time the network stalls.
   */
  readonly pending?: boolean;
  readonly failed?: boolean;
}

export interface IConversationPage {
  readonly messages: readonly IMessage[];
  readonly nextCursor: string | null;
  readonly conversation: IConversationSummary;
}

export interface IInboxPage {
  readonly conversations: readonly IConversationSummary[];
  readonly nextCursor: string | null;
}

/** What the live stream pushes down. */
export interface IStreamEvent {
  readonly type: 'message:new' | 'message:read' | 'conversation:new';
  readonly payload: {
    readonly conversationId: string;
    readonly messageId?: string;
    readonly body?: string;
    readonly sender?: string;
    readonly createdAt?: string;
    readonly preview?: string;
    readonly subject?: string;
    /**
     * On `message:read`: the moment the other side opened the thread.
     * Everything I sent at or before it has been read, which is what turns
     * one tick into two without refetching the page to find out which.
     */
    readonly at?: string;
    readonly by?: string;
  };
}

/** One person the picker can offer. */
export interface IDirectoryPerson {
  readonly id: string;
  readonly model: 'Lecturer' | 'Student';
  readonly name: string;
  readonly email: string | null;
  readonly role: string | null;
  /** Their office, or a registration number — whatever tells two people apart. */
  readonly subtitle: string | null;
}

export interface IDirectoryGroup {
  readonly label: string;
  readonly hint: string | null;
  readonly people: readonly IDirectoryPerson[];
}

export interface IDirectory {
  readonly groups: readonly IDirectoryGroup[];
  /** Set when this audience is not open to the caller, and says why. */
  readonly unavailableReason: string | null;
}


/** The response envelope every non-streaming Acheva endpoint returns. */
export interface IAPIResponse<T> {
  readonly status: boolean;
  readonly statusCode: string;
  readonly data: T;
  readonly message: string;
}
