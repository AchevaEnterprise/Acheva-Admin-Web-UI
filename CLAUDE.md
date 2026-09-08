# acheva-admin-WEB-UI — Admin Console

Angular 20 · standalone · signals · SCSS · `ng serve --port 4300`
API base: `src/environments/environment.ts` → `BASE_URL`.

Auth is admin-only (`POST /auth/admins/login`), stored under
`acheva-admin-token` / `acheva-admin-account` in localStorage. Admins are
**global Acheva staff** — the `Admin` schema carries no `school`, which is what
lets the support desk serve every institution at once.

## Support desk (`/support`, built 2026-09-08)

The admin side of the messaging core in `acheva-nestjs/src/messaging/`. A
two-pane queue: tickets left, the conversation right — the same shape as both
portals' chat, so an admin who has seen either already knows how to read it.

- **A queue, not a mailbox.** Every admin sees every ticket, including ones
  raised before they joined. The server lists `kind: SUPPORT` by role rather
  than by participation, and adds an admin to a thread the first time they open
  it so their unread count and read receipts start working.
- **Replies go out as "Acheva Support"**, never under a personal name — the
  person answering may change between two messages, and a user should not come
  to expect whoever replied last time.
- **An admin cannot raise a ticket.** The desk answers; it does not write in.
- Files live flat in `features/support/`: `messaging.model.ts`,
  `messaging.service.ts` (SSE via `fetch` + `ReadableStream`, since
  `EventSource` cannot set an `Authorization` header), `message-ticks.ts`,
  `chat-thread.ts` and the page. They are hand-kept copies of the portals'
  versions — the three repos share no package. **Change one, change all three.**
- `/support` is declared `data: { fullBleed: true }`; `Layout` reads that off
  the deepest activated route and turns the shell from a scrolling document
  into a fixed frame, so the two panes scroll on their own.

Verified end to end by `npm run test:messaging-surfaces` in `Acheva-WEB-UI/`,
which raises a ticket in the student portal, answers it here, and checks the
reply reaches the student with no reload.

## Notes

- There is **no `lint` script** in this repo; `ng build` is the gate.
- `ToastService` exposes `success(message)` / `error(message)` only.
- Shared primitives are flat files: `shared/skeleton.ts`, `shared/confirm-dialog.ts`.
