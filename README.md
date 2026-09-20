# Agile Retro

A multi-tenant retrospective tool — **Company → Project → Retrospective** — that runs the meeting
rather than just storing its output.

Super Admins sign in with a password; everyone else gets a 12-hour, single-use email link. There is
no public sign-up: every account arrives by invitation from someone already inside the company or
project.

**What it does beyond a board of sticky notes:**

- **A guided session.** The facilitator moves everyone through Lobby → Check-in → Collect → Group →
  Vote → Discuss → Actions → Closed together. Each step permits only what belongs to it, so the
  retro stops being eight activities happening at once.
- **Safe ideation.** During Collect nobody sees anyone else's cards — including the facilitator.
  Enforced by not fetching them, not by hiding them in CSS.
- **Real anonymity.** On an anonymous board the browser is never sent an author id, a voter id, or a
  member list to join them against. See [Anonymity and privacy](#anonymity-and-privacy).
- **Dot voting** with a per-person budget and tallies hidden until voting closes, so early votes
  don't snowball.
- **Guided discussion** — the group works through cards in one server-decided order, so everyone is
  looking at the same one.
- **Action items that survive the meeting.** Real statuses (Open / In progress / Blocked / Done /
  Dropped), assignees, due dates, carry-over into later retrospectives, a personal `/my-actions`
  page, and emailed reminders.
- **Cross-retro insights** — participation, completion rate, time-to-close, board sentiment,
  recurring themes. Computed locally; no data leaves the deployment.
- **Anonymous team health check-ins** with k-anonymity thresholds, so a small team can answer
  honestly.
- **Export** to Markdown or CSV.
- Templates, drag-and-drop, card merging, comments, emoji reactions, a shared timer, @mentions, live
  presence and cursors — all synced over Socket.IO.

## Stack

- **Next.js 16** (App Router, TypeScript, strict) — single Node process, deploys as one Azure Web App
- **Prisma 7** + PostgreSQL (via the `pg` driver adapter)
- **Auth.js (NextAuth v5)** — two Credentials providers: password (Super Admins) and one-time login
  tokens (everyone else)
- **Microsoft Graph** (`sendMail`, app-only auth) for all outgoing email
- **Socket.IO**, attached to a custom `server.ts` alongside the Next.js request handler
- **[@platned/ui](https://www.npmjs.com/package/@platned/ui)** design system, **@dnd-kit** for the
  board, **Tailwind 4**
- **Vitest** against a real Postgres — 230 tests, no mocked database

## Quick start

```bash
npm install
cp .env.example .env     # then fill it in — see below
npm run dev
```

That is the whole setup. Point `DATABASE_URL` at an **empty** Postgres and the first start creates
every table, index and constraint, then creates your Super Admin. Open `http://localhost:3000` and
sign in with `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`.

The values you need in `.env`:

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | An empty database is fine — it will be set up for you. Tested on Postgres 16 and 18 |
| `AUTH_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `APP_URL` | `http://localhost:3000` in dev |
| `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, `SUPER_ADMIN_NAME` | Used once, to create the first account |
| `GRAPH_*` | Optional locally — see below |

**Email is optional in development.** Without the `GRAPH_*` values, sending fails and is logged;
everything except emailed sign-in links still works, and you can sign in as the Super Admin with a
password. To enable it, register an Entra ID app with the **Mail.Send** *application* permission
(admin consent granted) and set `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET` and
`GRAPH_SENDER_EMAIL`.

Everyone other than the seeded Super Admin has to be **invited**. Use that account to create the
first company and project, then "Invite" on a project or company page.

### How the database sets itself up

On every start, before a single request is served, the app:

1. Asks which migrations are applied — one query against `_prisma_migrations`.
2. Applies any that are pending, via `prisma migrate deploy`.
3. Creates the Super Admin **only if the `User` table is completely empty**.

An up-to-date database costs about 15ms, because the Prisma CLI is only invoked when something is
genuinely pending — `tsx watch` restarts stay fast.

Seeding never updates an existing user, so a restart can't undo a password somebody changed. Two
deliberate consequences:

- To **re-provision** an admin on purpose, run `npm run db:seed` — that one *does* overwrite.
- If every admin is deliberately demoted, a restart won't conjure a new one from environment
  variables. The rule is "no users at all", not "no Super Admin".

If setup fails the process exits rather than serving against a half-built schema, and says what
went wrong in terms you can act on. `npm run db:migrate` / `npm run db:deploy` still apply
migrations by hand, and `AUTO_MIGRATE=false` turns the automatic path off entirely.

## Anonymity and privacy

Worth reading before trusting this with candid feedback, because these are properties of the
queries rather than the UI.

- **Anonymous boards.** The payload sent to the browser contains no `authorId`, no `userId` on votes
  or reactions, and no project member list. There is nothing to join, so the usual
  open-dev-tools-and-match trick has no key to work with. Cards arrive with `isOwn` and
  `authorName` already decided by the server, and the shape is identical whether or not the board
  is anonymous — one code path, so redaction cannot be forgotten for one of them.
- **Safe ideation.** During Collect, other people's cards are *not fetched*. The facilitator is not
  exempt. Once the board has been revealed the flag latches off: content that has been read cannot
  be un-read, and the settings dialog refuses to pretend otherwise.
- **Health check-ins** store no user id at all. A submission is keyed by
  `HMAC-SHA256(userId, retro.healthSalt)`, with a fresh salt per retrospective — so you can amend
  your own answer, but nobody (including someone with database access) can attribute a score or
  follow one person across retrospectives. Nothing is reported below 3 submissions, and
  distributions wait for 5.
- **AI is off by default, per company.** `Company.aiFeaturesEnabled` gates any future model call,
  and a platform Super Admin cannot bypass it — only the company's own admins can turn it on.
  Insights and themes are computed locally and work identically either way.
- **Emails never reach the browser.** Queries select `{ id, name }` for anything rendered next to
  content; addresses are looked up server-side at the point of sending.

## Testing

```bash
npm run test:db:up     # throwaway Postgres on port 5433 (Docker)
npm test
npm run test:db:down
```

The suite runs against a **real** database, not a mock: most of what it protects are query-shape
concerns — authorization scoping, payload redaction, migration correctness — that a mocked client
would happily accept. It refuses to run unless `DATABASE_URL` points at a local database whose name
ends in `_test`.

`npm run test:watch` for a watcher. CI runs the same suite against a Postgres service container, so
a green run also proves every committed migration still applies to an empty database.

## Why a custom `server.ts`

Socket.IO needs a long-lived `http.Server` to attach a WebSocket upgrade handler to. `server.ts`
creates that server once, hands HTTP requests to Next's own handler, and runs Socket.IO alongside it
in the same process — so the whole app is still one deployable Node process, started with `tsx
server.ts` instead of `next start`.

Two consequences worth knowing:

- **`next.config.ts` must not set `output: "standalone"`** — Next doesn't trace custom server files
  in that mode.
- **Nothing in `server.ts`'s import graph may use `server-only`**, which throws when imported
  outside the react-server condition. That is why `src/lib/socket/roomAccess.ts` and
  `src/server/bootstrap.ts` are deliberately standalone. Anything needing the app's own modules goes
  in `src/instrumentation.ts` instead, which Next bundles.

## Environment variables

| Variable | Used for |
| --- | --- |
| `DATABASE_URL` | Postgres connection (Prisma) |
| `AUTH_SECRET` | Session JWT signing/encryption (Auth.js) |
| `APP_URL` | Absolute links in emails, **and** the base URL Auth.js uses for every sign-in/sign-out redirect (see below) |
| `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET`, `GRAPH_SENDER_EMAIL` | Sending email via Microsoft Graph |
| `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, `SUPER_ADMIN_NAME` | Creating the first account on an empty database |
| `PORT` | Port `server.ts` listens on (Azure sets this automatically) |
| `AUTO_MIGRATE` | Defaults on. Applies pending migrations at startup and seeds the first Super Admin on a completely empty database. `"false"` skips both |
| `RUN_SCHEDULER` | `"true"` on **exactly one** instance enables due-date reminders and cleanup. Unset everywhere else, including every developer machine |

None of these belong in source control — `.env*` is git-ignored except `.env.example`.

**`APP_URL` doubles as Auth.js's base URL.** `server.ts` sets `AUTH_URL = APP_URL` at startup, so
every redirect is anchored to it rather than depending on the `Host` header surviving whatever
reverse proxy sits in front (Azure App Service's included). Get it wrong in production and
*everything* breaks the same way: emailed links, sign-out, sign-in redirects. `server.ts` refuses to
start in production if `APP_URL` is unset or still contains `localhost`.

## Background jobs

Set `RUN_SCHEDULER=true` on **exactly one** instance to enable:

- **Due-date reminders** — one email per action item, ever. The marker is written whether or not the
  send succeeds, so a 15-minute sweep can never become a daily nag.
- **Cleanup** of spent login tokens and invitations that lapsed unaccepted. Accepted invitations are
  kept: `acceptedAt` is the only record of how somebody came to be in a company.

It is an interval in the web process rather than a queue — deliberate for a single-instance
deployment, and `RUN_SCHEDULER` is what makes that reversible when it isn't one.

> **Never set it on a developer machine.** Your `.env` points at a real database and holds real
> Graph credentials, so the process will delete rows and email real people. The scheduler refuses to
> start if `APP_URL` is unset, localhost, or a reserved test domain, which catches the common form
> of that mistake but not all of it.

## Deploying to Azure Web App

A single Node process, so it deploys as an ordinary **Azure Web App (Linux, Node 20 LTS)** — no
separate services needed.

1. **Runtime & startup**
   - Stack: Node 20 LTS.
   - Deployment is a zip push from GitHub Actions on every `PROD` push (see
     `.github/workflows/ci.yml`). It ships **source**, so Oryx runs `npm install` (needs full
     `dependencies`, not just prod-only — `tsx`, `dotenv` and `cross-env` are regular dependencies
     for exactly this reason) then `npm run build` on the server. Don't also wire up the Deployment
     Center: two deployers racing each other is worse than either alone.
   - Startup command: leave default (`npm start`), which runs
     `cross-env NODE_ENV=production tsx server.ts` and honours the `PORT` App Service injects.

2. **Application settings** — add every row from the table above as an Application Setting. Set
   `APP_URL` to the real `https://<your-app>.azurewebsites.net` or custom domain.

3. **Enable WebSockets** — Configuration → General settings → **Web sockets: On**. Without it
   Socket.IO falls back to polling or fails outright.

4. **Enable Always On** — prevents the app idling out and dropping every open WebSocket.

5. **Database firewall** — allowlist the Web App's outbound traffic on the Postgres server
   (firewall/security group **and** `pg_hba.conf`, if it also restricts by host — both layers exist
   independently and both need an entry). Two caveats we hit ourselves:
   - A `pg_hba.conf` edit needs a reload (`SELECT pg_reload_conf();`) — it does not take effect
     until then.
   - **Standard App Service tiers have no single stable outbound IP.** Azure publishes a *pool*
     (Networking → Outbound IP addresses) and any of them may be used. Allowlist the whole pool, or
     — more robust, and the honest recommendation if this matters for your security posture — put
     the Web App behind Regional VNet Integration with a NAT Gateway for one fixed egress IP.

6. **Migrations and the first admin** are automatic; nothing to run by hand for a first deploy.

   Every push to `PROD` *also* runs `prisma migrate deploy` from GitHub Actions before the deploy
   step. That is belt-and-braces rather than duplication: a migration that cannot apply fails the
   pipeline and the old code keeps serving, whereas relying on startup alone would turn the same
   problem into a crash-looping Web App.

   > **That step applies hand-written migrations to production unattended,** and some are
   > destructive. Before releasing one you haven't rehearsed against a copy, take a backup with
   > `npx tsx scripts/backup.ts <file>` and check it afterwards with
   > `npx tsx scripts/compare-rows.ts <file>`. `scripts/restore-rows.ts` puts rows back.
   >
   > Both production jobs declare `environment: production`, so adding a required reviewer under
   > Settings → Environments turns the release into a one-click approval. Worth doing.

7. **Single-instance note** — Socket.IO room broadcasting assumes one Node process. Azure's default
   ARR affinity makes this correct even on a multi-instance plan, *as long as you don't rely on
   cross-instance broadcast*. For true fan-out, add the
   [Socket.IO Redis adapter](https://socket.io/docs/v4/redis-adapter/); nothing else changes,
   because every emit already goes through `getIO()` / `broadcastToRetro()`.

## Project structure

```
server.ts                    Custom Next.js + Socket.IO entrypoint (dev and prod)
src/instrumentation.ts       Runs once at server start: scheduler, error reporting
src/proxy.ts                 Route protection (Next 16's replacement for middleware.ts)

prisma/schema.prisma         Company → Project → Retrospective data model
prisma/migrations/           Hand-written, committed migration history

src/app/(app)/               Authenticated shell: dashboard, admin, companies, projects,
                              retros, /my-actions, /projects/:id/insights
src/app/api/                 Auth.js route, and the retro export endpoint
src/components/retro/        The board: columns, cards, phase bar, discussion, health, timer

src/lib/authz.ts             require* guards — the authorization vocabulary
src/lib/retroPhases.ts       The phase rulebook, shared by server and UI so they can't disagree
src/lib/health.ts            Check-in dimensions, scale and k-anonymity thresholds
src/lib/export/              Markdown and CSV formatters
src/lib/insights/            Local theme extraction — no model calls
src/lib/socket/              Socket.IO singleton, typed events, client hook
src/lib/email/               Microsoft Graph mailer and HTML templates

src/server/bootstrap.ts      Startup migration and first-admin seeding
src/server/queries/          Reads. Plain server-only modules, never Server Actions
src/server/actions/          The Server Action boundary — thin wrappers returning ActionResult
src/server/retro/            Retro domain logic: lifecycle, cards, action items, phases, health
src/server/validation/       Zod schemas, one module per action module
src/server/scheduler/        Due-date reminders and cleanup jobs

tests/                       Vitest suite, run against a real Postgres
scripts/                     Backup, restore, row comparison and migration pre-flight tooling
```

### A convention worth knowing

**Reads throw; mutations return results.** Queries in `src/server/queries/` throw `NotFoundError` /
`ForbiddenError`, which Server Components turn into `notFound()` or an error page. Server Actions
return `ActionResult<T>` instead, because Next.js replaces a thrown error's message with an opaque
digest in production — a carefully worded refusal would otherwise reach users as "An error
occurred". Both conventions are deliberate; don't unify them.
