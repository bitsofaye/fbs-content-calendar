# FBS Content Calendar System

A multi-client social media content calendar for **Frontline Business Solutions**. It replaces the
`FBS Social Media Calendar.xlsx` workbook while keeping its vocabulary: pillars/services, statuses,
approvers, platforms, pubmats, captions and results.

| | |
|---|---|
| Frontend | Vite + React 18 + Tailwind CSS v4 (`client/`) |
| Backend | Express 5 + Prisma 6 (`server/`) |
| Database | PostgreSQL on **Supabase** (also used during local development) |
| Auth | JWT bearer tokens with role-based access: `ADMIN` (FBS team) and `CLIENT` |

## Features

- **Dashboard per client**: monthly KPIs (posts, published, waiting for approval, needs edits, reach,
  engagement), the pillar mix, and the monthly theme banner.
- **Five views** sharing one filter bar (search, status, pillar, platform, approver, organic or ad):
  - **Calendar**: a month or week grid like the old sheet, with a color key, weekday pillars in the
    header and PH holidays. Drag posts to reschedule, drag ideas from the side panel onto a day, and
    double-click a day to add a post.
  - **Sheet**: a spreadsheet-like table with inline editing (saved automatically in batches), sorting,
    optional caption/results columns and **Export CSV**.
  - **Daily cards**: one day at a time, with a day strip and Approve / Request changes / Send for
    approval buttons on each card.
  - **Board**: a Kanban board by stage (Ideas, Production, Review, Ready, Live) with drag-and-drop.
  - **Idea bank**: undated topics grouped by pillar, with a Schedule button.
- **Approval workflow**: replaces the "for approval po sir @…" cell comments.
  - *Send for approval* sets the status to **For approval**.
  - The approver or client can **Approve**, **Request changes** (status becomes To edit) or **Reject**.
    Request changes and Reject need a comment.
  - Every change is logged in the post's **History**, and each post has a **Comments** thread.
- **Admin overview**: client cards plus queues for *My approvals*, *Waiting for approval*,
  *Needs edits* and *Next 7 days* across all clients.
- **Generate month**: creates empty slots for every weekday pillar (for example, every Monday gets a
  Motivational Monday post).
- **Ads**: posts of type *Ad* get an Ad setup tab with primary text, headline, description, CTA,
  ad sets/targeting and the Botcake message.
- **Results**: reacts, comments, shares, reach, engagement, link clicks and feedback per post.
- **Clients, pillars and monthly themes, and users** are managed from the admin pages. Adding a client
  can create a starter set of pillars.
- **Workbook import**: imports the 2026 rows from the `.xlsx` file, either from the Import page (with a
  preview you can edit) or from the CLI. Re-imports skip rows already imported.

## Run it locally

### 1. Requirements
- Node.js 20 or newer (tested on Node 24)
- A free [Supabase](https://supabase.com) project (nothing to install locally)

### 2. Database connection strings
In Supabase, open **Project → Connect → ORMs → Prisma** and copy the two URLs:
- **Transaction pooler** (port `6543`) goes in `DATABASE_URL`. Keep `?pgbouncer=true`.
- **Session/direct** (port `5432`) goes in `DIRECT_URL`. Migrations use this one.

### 3. Configure
```bash
cp server/.env.example server/.env      # then fill in DATABASE_URL, DIRECT_URL, JWT_SECRET, SEED_* values
cp client/.env.example client/.env      # VITE_API_URL=http://localhost:4000/api
```
To generate a JWT secret, run: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

### 4. Install, migrate, seed
```bash
npm install            # installs both workspaces and generates the Prisma client
npm run db:migrate     # creates the tables in Supabase (prisma migrate dev)
npm run db:seed        # admin login, FBS client (pillars, colors, themes), Demo Client + client login
```

The seed creates:
- the admin login from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`
- the **FBS** client with:
  - the HR/E&A legend categories, using the sheet's KEY colors
  - the SMM pillars, with the 2026 weekday rotation (Mon Motivational Monday, Tue Local Accounting,
    Wed Social Media Management, Thu Testimonials-LCS, Fri FBS-Company)
  - the Sep–Dec 2025 monthly themes from *Monthly Theme Contents*
- a **Demo Client** with sample posts and a client login (`SEED_CLIENT_EMAIL` / `SEED_CLIENT_PASSWORD`)

Re-running the seed is safe. It never overwrites existing passwords.

### 5. Import the 2026 content from the workbook
Do a dry run first. It prints what it would import and writes nothing:
```bash
npm run import -- "FBS Social Media Calendar.xlsx" --client fbs --year 2026
```
When the dry run looks right, write the rows:
```bash
npm run import -- "FBS Social Media Calendar.xlsx" --client fbs --year 2026 --commit
```
You can also use **Import workbook** in the app, which lets you preview and edit the rows before
importing.

| Sheet | Becomes |
|---|---|
| Content proposals | Organic posts: service becomes the pillar, plus platforms, status, approver, story board, pubmats, caption/hashtags, remarks |
| Contents for Approval | Organic posts with results (reacts, reach…) and feedback; the category is guessed from the topic |
| Ads for Approval | Ad posts with primary text, headline/description/CTA, ad sets and Botcake message |
| Contents | Undated ideas in the Idea bank |
| Month-grid sheets, Monthly Theme Contents, Sheet18, Content Planner | Not imported (no 2026 rows). Themes and colors were built into the seed |

**Approvers.** The sheet's approver names ("Sir Carlo", "Sir Jhonny", "Ms. Ayeca") are kept as text
until a matching user exists. In **Users**, add the team members with their real names, for example
*Carlo Del Monte*. Their imported posts are then linked to them automatically.

### 6. Start
```bash
npm run dev            # API on http://localhost:4000, web app on http://localhost:5173
```

## Scripts
| Command | What it does |
|---|---|
| `npm run dev` | Starts the API and the web app together |
| `npm run build` | Production build of the web app (`client/dist`) |
| `npm run db:migrate` | Applies schema changes (`prisma migrate dev`) |
| `npm run db:seed` | Seeds the base data |
| `npm run db:studio` | Opens Prisma Studio to browse the database |
| `npm run import -- <file> [--client fbs] [--year 2026] [--commit] [--no-ideas] [--verbose]` | Workbook import |
| `npm test` | Runs the importer unit tests (server) |

## Roles
| | Admin | Client |
|---|---|---|
| See clients | All | Only their own |
| Create, edit, delete, reschedule posts | ✔ | — |
| Approve, request changes, reject | ✔ | ✔ (own client) |
| Comment | ✔ | ✔ (own client) |
| Clients, pillars, themes, users, import | ✔ | — |

The API enforces these rules: a client token used on another client's data gets `403`.

## Deploying later (free tiers)

**Database (Supabase).** Use the same project. Run `npm run db:deploy -w server` once with the
production `.env`, or let Render run it, as below.

**API (Render).** Create a *Web Service* from this repo:
- Root directory: `server`
- Build command: `npm install && npx prisma generate && npx prisma migrate deploy`
- Start command: `node src/index.js`
- Environment variables: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, and
  `CLIENT_ORIGIN=https://<your-app>.vercel.app`
- Free instances sleep after about 15 minutes idle, so the first request can take up to a minute. The
  web app allows for this with a 60s timeout.

**Web app (Vercel).** Import the repo:
- Root directory: `client`
- Framework: Vite
- Environment variable: `VITE_API_URL=https://<your-api>.onrender.com/api`
- `client/vercel.json` already rewrites all routes to `index.html` for client-side routing.

## Project layout
```
server/
  prisma/schema.prisma        data model (User, Client, Pillar, MonthlyTheme, Post, Comment, ActivityLog)
  prisma/migrations/          SQL migrations
  prisma/seed.js
  src/app.js, src/index.js    Express app
  src/routes/                 auth, clients, pillars, themes, posts, users, dashboard, import
  src/importers/              fbsWorkbook.js (xlsx → posts, no DB) and commitImport.js (writes to DB)
  scripts/import-xlsx.js      CLI importer
  test/                       importer unit tests (vitest)
client/
  src/pages/ClientDashboard.jsx   per-client dashboard and view switcher
  src/pages/views/                Calendar, Sheet, Daily, Board, Ideas
  src/components/PostDrawer.jsx   create/edit/review a post, comments and history
  src/pages/admin/                Clients, Pillars & themes, Users, Import
  src/lib/                        api client, constants (statuses/platforms), dates, PH holidays, CSV
```

## Roadmap ideas
- Import the old cell comments from the workbook as post comments
- Email or Messenger notifications when a post needs approval
- Recurring posts, plus automatic birthday and work anniversary posts from an employee list
- Upload pubmats to Supabase Storage instead of linking to Drive or Canva
- A read-only share link for clients without a login
- Pull results automatically from the Meta Graph API
- Dark mode
