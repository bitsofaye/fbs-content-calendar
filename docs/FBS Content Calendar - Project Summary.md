# FBS Content Calendar System – Project Summary

A short summary of how the Content Calendar System was built, from the Excel workbook to a live website.

**Live site:** https://fbs-content-calendar.vercel.app
**Code:** GitHub repository `bitsofaye/fbs-content-calendar`

---

## 1. The goal

Replace the Excel file **FBS Social Media Calendar.xlsx** with one web system where FBS can:

- plan social media posts for FBS and for every client
- review and approve posts in the system, instead of through cell comments like "for approval po sir @…"
- give clients their own login to see, approve and comment on their posts
- see dashboards, results and what needs attention

## 2. What we started from

We read the whole workbook (9 sheets) and kept its vocabulary:

- **Statuses:** In progress, Created, Edited, To edit, For approval, Approved, Rejected, On hold, Reschedule, Scheduled, Published, Boosted, plus Idea
- **Platforms:** Facebook Post, Instagram Post, LinkedIn Post, Facebook and Instagram Reels, YouTube Shorts, Clips and Video, TikTok, Story
- **Pillars:** Motivational Monday, Local Accounting, Social Media Management, Testimonials-LCS, FBS-Company and others, plus the HR / E&A colours from the old calendar
- **Fields:** story board, caption, hashtags, pubmat links, approver, remarks, results (reacts, reach, engagement…) and ad details

## 3. How it is built

| Part | Tool | What it does |
|---|---|---|
| Website | React + Vite + Tailwind CSS | The pages people use |
| Server | Node.js + Express | Sign-in, rules on who can do what, saving data |
| Database | Supabase (PostgreSQL, Singapore) | Stores clients, posts, users, comments, history |
| Database tool | Prisma | Table design and safe database updates |
| Website hosting | Vercel (free) | Publishes the website |
| Server hosting | Render (free) | Runs the server |
| Code storage | GitHub | Keeps every version; pushing updates Vercel and Render |

## 4. Main steps

1. **Planned the system** from the workbook: data model, roles (FBS admin and client user) and approval flow.
2. **Built the server**: sign-in with passwords, admin and client permissions, posts, comments, history, dashboards, approvals.
3. **Built the website** with these pages: Dashboard, Approvals, Calendar, Content plan, Daily view, Board, Idea bank, Results, plus Manage pages for Clients, Pillars & themes, Users and Import.
4. **Imported the 2026 content** from the workbook: 102 posts from Content proposals, 22 from Contents for Approval, 2 ads and 13 ideas.
5. **Set up the database** on Supabase and created the first admin and demo client accounts.
6. **Redesigned it several times**, each time with a preview for approval first:
   - FBS colours, Poppins font, clearer menu and dashboards
   - soft look: white menu, light background, burgundy highlights
   - client logins see their own company colour; FBS sees FBS colours on every client
   - full client names, no Idea bank panel on the calendar
7. **Added features on request:**
   - Content plan text wrapping and full platform names
   - clearer card dragging on the Board
   - New post and Generate month only on Calendar and Content plan
   - select all, archive, restore and delete in the Content plan
   - resizable Content plan columns and rows
   - **Import CSV**: add many posts from a CSV file with 14 required headings, replacing the .xlsx upload
8. **Put it online**: code on GitHub, server on Render, website on Vercel, connected to Supabase.
9. **Wrote the documents** (in the `docs` folder):
   - User Guide (54 pages, version 1.4)
   - Quick User Guide (PDF)
   - Deployment Guide
   - Errors and Fixes log

## 5. Problems we solved along the way

| Problem | Fix |
|---|---|
| "Cannot reach the server" on the computer | Created the missing `.env` settings files and stopped old test servers |
| Drive C: full, so the website would not load | Freed space and cleared the website's temporary cache |
| Vercel: "No Output Directory named public" | Added `vercel.json`, set Root Directory to `client`, and linked the right repo |
| Live site still calling `localhost` | Added `VITE_API_URL` in Vercel and redeployed |
| Render: Start Command required / "Missing script: start" | Start Command `npm start`, Root Directory `server` |
| Render: `DIRECT_URL` not found | Added the database and sign-in settings in Render's Environment page |
| Site feels slow | Server sleeps on the free plan and runs in Oregon (US). Next step is moving it to Singapore |

## 6. Where things stand

**Working:** the live site, sign-in, all calendar pages, approvals, Import CSV and the dashboards.

**Next steps:**

- Move the Render server to **Singapore**, and change `connection_limit=1` to `5`
- Keep the server awake with a free uptime check every 10 minutes (or use Render's paid Starter plan)
- Speed improvements in the code: smaller replies, lighter lists, extra indexes, browser caching
- Create team accounts (Sir Carlo, Ms. Ayeca, Sir Jhonny) so imported approvals link to them
- Change or disable the demo client login
- Make the old public repo `bitsofaye/fbscontentcalendar` private, or delete it

## 7. How changes are made

1. A change is shown first in a **preview** on the computer (`localhost:5174`).
2. After **"Apply"**, it is moved into the real app, built and tested.
3. The user guide is updated.
4. The change is **pushed to GitHub**, and Vercel and Render update the live site automatically.
