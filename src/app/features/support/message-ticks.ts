import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Sent, or sent and read. Nothing is drawn while a message is still in flight. */
export type TickState = 'none' | 'sent' | 'read';

/**
 * The delivery ticks beside a message.
 *
 * One tick means the server has it; two mean the other side has opened the
 * thread since it arrived. The shape is WhatsApp's because everyone already
 * reads it without being taught — but the read colour is Acheva blue, the same
 * decision that made outgoing bubbles blue rather than green.
 *
 * Drawn as one inline SVG rather than two overlapping glyphs so the double
 * tick keeps its exact overlap at any size, and so a bubble can recolour it by
 * inheriting `currentColor`.
 */
@Component({
  selector: 'app-message-ticks',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (state() !== 'none') {
      <svg
        class="ticks"
        [class.ticks--read]="state() === 'read'"
        viewBox="0 0 20 12"
        width="17"
        height="11"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"
        role="img"
        [attr.aria-label]="state() === 'read' ? 'Read' : 'Sent'"
      >
        <title>{{ state() === 'read' ? 'Read' : 'Sent' }}</title>
        <polyline points="1 6.6 4.6 10.2 11.4 2" />
        @if (state() === 'read') {
          <polyline points="8.4 6.6 12 10.2 18.8 2" />
        }
      </svg>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      vertical-align: -1px;
    }

    /* Unread inherits the meta line colour, so it is legible on a white
       bubble and on a blue one without either being special-cased. */
    .ticks {
      color: inherit;
      opacity: 0.75;
    }

    /* Read is the one state that gets its own colour, because it is the one
       the sender is actually looking for. The host sets --tick-read: deep
       brand blue on a white ground, plain white inside a blue bubble, where a
       blue tick on blue would be the one state nobody could see. */
    .ticks--read {
      color: var(--tick-read, #0b3d6e);
      opacity: 1;
    }
  `,
})
export class MessageTicks {
  readonly state = input.required<TickState>();
}
