// Seeds: first admin, the FBS client (pillars, legend colors, weekday rotation, monthly themes),
// and a Demo Client with a client login + sample posts.  Safe to re-run (upserts).
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const env = (k, fallback) => process.env[k] || fallback;

// Weekday: 0=Sun 1=Mon ... 6=Sat. Rotation taken from the 2026 "Content proposals" rows.
const FBS_PILLARS = [
  // SMM content pillars
  { name: 'Motivational Monday', color: '#6366f1', weekday: 1 },
  { name: 'Local Accounting', color: '#ef4444', weekday: 2 },
  { name: 'Social Media Management', color: '#0ea5e9', weekday: 3 },
  { name: 'Testimonials-LCS', color: '#14b8a6', weekday: 4 },
  { name: 'FBS-Company', color: '#f59e0b', weekday: 5 },
  { name: 'Virtual Assistance', color: '#a855f7' },
  { name: 'Web Solutions', color: '#3b82f6' },
  { name: 'HRIS Payroll Tuesday', color: '#22c55e' },
  { name: 'Web Wednesday', color: '#2563eb' },
  { name: 'Thoughtful Thursday', color: '#8b5cf6' },
  { name: 'Learning Center Solutions', color: '#0d9488' },
  { name: 'Holiday', color: '#e11d48' },
  // HR / E&A legend (colors from the sheet's KEY)
  { name: 'Birthday/Work Anniversary Postings', color: '#fae0b5' },
  { name: 'LCS Activities', color: '#7fded2' },
  { name: 'Company Fellowships', color: '#b4bbe8' },
  { name: 'Company Events', color: '#f9aabe' },
  { name: 'Company Announcements', color: '#ff6d01' },
  { name: 'Accounting', color: '#ff0000' },
  { name: 'Marketing Engagement', color: '#ff00ff' },
];

// From the "Monthly Theme Contents" sheet
const FBS_THEMES = [
  {
    year: 2025, month: 9, title: 'Business Preparedness & Efficiency',
    notes: 'Mon Local Accounting · Tue Web Dev/Web App · Wed Virtual Assistance · Thu LCS Testimonials · Fri FBS Company. Formats rotate: Short Video, Promotional Post, Testimonials write-ups.',
  },
  {
    year: 2025, month: 10, title: 'Digital Marketing Power-Up',
    weeklyFocus: [
      { week: 1, focus: 'Local SEO | Keywords Guide | Local Success Story' },
      { week: 2, focus: 'VA for Growth | Delegation Strategy | VA Story' },
      { week: 3, focus: 'Landing Pages | Lead Magnets | Case Study' },
      { week: 4, focus: 'Video Testimonials | Feedback Highlights | Success Reel' },
    ],
  },
  {
    year: 2025, month: 11, title: 'Year-End Readiness',
    weeklyFocus: [
      { week: 1, focus: 'HRIS Year-End Tools | HR Planning Tips | Year-End Client Result' },
      { week: 2, focus: 'SEO Final Checklist | 2025 Recap | Ranking Results' },
      { week: 3, focus: '2026 Planning | Social Trends | Strategy Example' },
      { week: 4, focus: 'Webinar Invite | Learning Topics | Final CTA to Register' },
    ],
  },
  {
    year: 2025, month: 12, title: 'Holiday and Christmas Postings',
    weeklyFocus: [
      { week: 1, focus: '2025 Achievements Recap | Key Milestones | Client Thank You Post' },
      { week: 2, focus: 'Service Highlights of the Year | Top Tips Recap | Client Success Story' },
      { week: 3, focus: 'Holiday Greeting | Faith & Gratitude Message | Team Celebration Post' },
    ],
  },
];

const DEMO_PILLARS = [
  { name: 'Promotional', color: '#3b82f6', weekday: 1 },
  { name: 'Educational / Tips', color: '#10b981', weekday: 3 },
  { name: 'Engagement', color: '#f59e0b', weekday: 5 },
  { name: 'Testimonials', color: '#8b5cf6' },
  { name: 'Holiday', color: '#e11d48' },
];

async function upsertUser({ email, name, password, role, clientId = null }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing; // never overwrite a real password on re-seed
  return prisma.user.create({
    data: { email, name, role, clientId, passwordHash: await bcrypt.hash(password, 10) },
  });
}

async function upsertPillars(clientId, list) {
  const out = {};
  for (const [i, p] of list.entries()) {
    out[p.name] = await prisma.pillar.upsert({
      where: { clientId_name: { clientId, name: p.name } },
      create: { clientId, sortOrder: i, weekday: p.weekday ?? null, name: p.name, color: p.color },
      update: {},
    });
  }
  return out;
}

function isoInMonth(base, day) {
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), day));
  return d;
}

async function main() {
  // --- admin ---
  const admin = await upsertUser({
    email: env('SEED_ADMIN_EMAIL', 'admin@example.com').toLowerCase(),
    name: env('SEED_ADMIN_NAME', 'FBS Admin'),
    password: env('SEED_ADMIN_PASSWORD', 'ChangeMe123!'),
    role: 'ADMIN',
  });

  // --- FBS ---
  const fbs = await prisma.client.upsert({
    where: { slug: 'fbs' },
    create: { name: 'Frontline Business Solutions', slug: 'fbs', brandColor: '#921259', industry: 'Business solutions' },
    update: {},
  });
  await upsertPillars(fbs.id, FBS_PILLARS);
  for (const t of FBS_THEMES) {
    await prisma.monthlyTheme.upsert({
      where: { clientId_year_month: { clientId: fbs.id, year: t.year, month: t.month } },
      create: { clientId: fbs.id, ...t },
      update: {},
    });
  }

  // --- Demo client ---
  const demo = await prisma.client.upsert({
    where: { slug: 'demo-client' },
    create: { name: 'Demo Client', slug: 'demo-client', brandColor: '#0f766e', industry: 'Restaurant' },
    update: {},
  });
  const demoPillars = await upsertPillars(demo.id, DEMO_PILLARS);
  const clientUser = await upsertUser({
    email: env('SEED_CLIENT_EMAIL', 'client@example.com').toLowerCase(),
    name: 'Demo Client Owner',
    password: env('SEED_CLIENT_PASSWORD', 'ChangeMe123!'),
    role: 'CLIENT',
    clientId: demo.id,
  });

  const demoCount = await prisma.post.count({ where: { clientId: demo.id } });
  if (demoCount === 0) {
    const now = new Date();
    const samples = [
      [2, 'Promotional', 'Weekend family bundle promo', 'PUBLISHED', ['FB_POST', 'IG_POST']],
      [4, 'Educational / Tips', '3 ways to keep food fresh longer', 'PUBLISHED', ['FB_POST', 'IG_POST']],
      [6, 'Engagement', 'This or that: Sinigang vs Adobo?', 'PUBLISHED', ['FB_POST', 'IG_POST', 'STORY']],
      [9, 'Promotional', 'New menu teaser reel', 'SCHEDULED', ['FB_REELS', 'IG_REELS', 'TIKTOK']],
      [11, 'Educational / Tips', 'Behind the kitchen: how we prep', 'APPROVED', ['FB_REELS', 'IG_REELS']],
      [13, 'Engagement', 'Tag a friend you would bring here', 'FOR_APPROVAL', ['FB_POST', 'IG_POST']],
      [14, 'Testimonials', 'Customer review highlight — Ms. Reyes', 'FOR_APPROVAL', ['FB_POST', 'IG_POST']],
      [16, 'Promotional', 'Payday sale graphics', 'TO_EDIT', ['FB_POST', 'IG_POST']],
      [18, 'Educational / Tips', 'Allergen guide carousel', 'EDITED', ['FB_POST', 'IG_POST', 'LINKEDIN_POST']],
      [20, 'Engagement', 'Poll: what should our next flavor be?', 'CREATED', ['STORY']],
      [23, 'Promotional', 'Catering services ad', 'IN_PROGRESS', ['FB_POST']],
      [25, 'Holiday', 'Holiday greeting', 'IN_PROGRESS', ['FB_POST', 'IG_POST', 'LINKEDIN_POST']],
      [27, 'Testimonials', 'Video testimonial from a regular', 'ON_HOLD', ['FB_REELS', 'YT_SHORTS']],
    ];
    for (const [day, pillar, title, status, placements] of samples) {
      await prisma.post.create({
        data: {
          clientId: demo.id,
          pillarId: demoPillars[pillar].id,
          date: isoInMonth(now, day),
          title,
          status,
          placements,
          caption: `${title} — sample caption text for the demo.`,
          hashtags: '#DemoClient #SampleOnly',
          approverId: clientUser.id,
          createdById: admin.id,
          ...(status === 'PUBLISHED' ? { reach: 500 + day * 37, engagement: 40 + day * 3, reacts: 30 + day, feedback: 'GOOD' } : {}),
        },
      });
    }
    await prisma.post.createMany({
      data: [
        { clientId: demo.id, pillarId: demoPillars['Promotional'].id, title: 'Loyalty card launch', status: 'IDEA', createdById: admin.id },
        { clientId: demo.id, pillarId: demoPillars['Engagement'].id, title: 'Guess the ingredient game', status: 'IDEA', createdById: admin.id },
      ],
    });
  }

  console.log('Seed complete.');
  console.log(`  Admin login:  ${admin.email}`);
  console.log(`  Client login: ${clientUser.email}  (Demo Client)`);
  console.log('  Next: npm run import -- "../FBS Social Media Calendar.xlsx" --client fbs --year 2026 --commit');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
