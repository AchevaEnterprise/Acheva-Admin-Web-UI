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
- **The composer's Send is a `type="submit"` button**, and this app imports
  no forms module there — so the form uses `(submit)` with
  `preventDefault()`. It used `(ngSubmit)`, which never fires without
  `FormsModule`/`[formGroup]`: clicking Send reloaded the page and the reply
  was lost (found 2026-11-10; the harness only ever pressed Enter). Any
  `<form (ngSubmit)>` here needs `[formGroup]` or this treatment.
- `/support` is declared `data: { fullBleed: true }`; `Layout` reads that off
  the deepest activated route and turns the shell from a scrolling document
  into a fixed frame, so the two panes scroll on their own.

Verified end to end by `npm run test:messaging-surfaces` in `Acheva-WEB-UI/`,
which raises a ticket in the student portal, answers it here, and checks the
reply reaches the student with no reload.

## Lecturers, Students, Logs (built 2026-11-09)

- `/lecturers` and `/students` share `shared/placement-filter.ts` (School →
  Faculty → Department, each "All" by default) and `shared/pager.ts`. Rows
  open a detail dialog: deactivate/reactivate a lecturer
  (`PATCH /lecturers/toggle-active-status/:id`), correct a student's
  registration number (`PATCH /admins/students/:id/regno`). Students show
  whether their transcript details are complete.
- `/logs` + `/logs/:id` — the ticket log (`src/tickets/` in the backend).
  Status tabs with counts, filters, a form dialog to raise or edit, and a
  detail page with the moves, notes, owner and the trail.
- **Open wide dialogs with `WIDE_DIALOG`** (`core/dialog.ts`). Material caps a
  dialog at 560px and clips anything wider off the LEFT edge with no
  scrollbar; the harness checks for it.
- New UI keeps to brand blue and weight ≤ 500: `adm-chip--brand / --tint /
  --outline / --muted`. The older `adm-chip--active` (green) is not used here.

## School fees & department options (built 2026-11-09)

- `/department` — an **Options** column; "Add options" / "Manage" opens a
  dialog to add, rename (carried onto every student who chose it) or switch
  off an option. Never delete — students and fees point at them.
- `/school-fees` — Acheva sets each university's fees: school and session
  pickers, the **payout account** card (bank + account number; Paystack
  confirms the holder's name), the **payments** card (in full / 2 / 3 and
  their due dates), and the **fees** grid — one collapsible section per
  department, levels down the side, the department fee plus one column per
  option ("Department fee" placeholder = falls back). "Use the 100 Level fee
  for every blank level" fills a department in one go. Save, then Publish
  (refused until the account is confirmed and a fee is set). Fees that have
  taken payments show tinted and read-only; the number of payments locks
  once any money lands. Amounts typed in naira, sent as kobo via
  `core/naira.ts`.
- **Receipts** (2026-11-10) — below the plan, `receipts-review.ts`: fees
  students paid at the bank or on Remita. Tabs Not yet checked / Verified /
  Rejected / All; open either file (streamed through the API into a new
  tab); Verify, or Reject with a reason the student is shown — a rejected
  receipt stops counting toward their fees. This is the manual check until
  the AI one (reading the Remita QR code) exists.
- Covered in browsers by `npm run test:school-fees-ui` in `Acheva-WEB-UI`.

## Notes

- There is **no `lint` script** in this repo; `ng build` is the gate.
- `ToastService` exposes `success(message)` / `error(message)` only.
- Shared primitives are flat files: `shared/skeleton.ts`, `shared/confirm-dialog.ts`.
