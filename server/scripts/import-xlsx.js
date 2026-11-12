#!/usr/bin/env node
// Import the FBS workbook from the command line.
//
//   npm run import -w server -- "../FBS Social Media Calendar.xlsx" --client fbs --year 2026            (dry run)
//   npm run import -w server -- "../FBS Social Media Calendar.xlsx" --client fbs --year 2026 --commit   (write to DB)
//
// Options: --client <slug>  --year <yyyy>  --commit  --no-ideas  --json <out.json>  --verbose

import fs from 'node:fs/promises';
import path from 'node:path';
import { parseFbsWorkbook } from '../src/importers/fbsWorkbook.js';

function parseArgs(argv) {
  const args = { file: null, client: 'fbs', year: null, commit: false, ideas: true, json: null, verbose: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--client') args.client = argv[++i];
    else if (a === '--year') args.year = Number(argv[++i]);
    else if (a === '--commit') args.commit = true;
    else if (a === '--no-ideas') args.ideas = false;
    else if (a === '--json') args.json = argv[++i];
    else if (a === '--verbose') args.verbose = true;
    else if (!a.startsWith('--')) args.file = a;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.file) {
  console.error('Usage: npm run import -w server -- <file.xlsx> [--client fbs] [--year 2026] [--commit]');
  process.exit(1);
}

// npm -w runs scripts from server/, so resolve relative paths from where the user typed the command too
const candidates = [path.resolve(process.cwd(), args.file), path.resolve(process.env.INIT_CWD || process.cwd(), args.file)];
let filePath = null;
for (const c of candidates) {
  try {
    await fs.access(c);
    filePath = c;
    break;
  } catch {
    /* try next */
  }
}
if (!filePath) {
  console.error(`File not found: ${args.file}`);
  process.exit(1);
}

const buffer = await fs.readFile(filePath);
const result = await parseFbsWorkbook(buffer, { year: args.year, includeIdeas: args.ideas });

console.log(`\nWorkbook: ${path.basename(filePath)}`);
console.log(`Sheets in workbook: ${result.sheets.join(' | ')}`);
console.log(`Parsed sheets: ${result.summary.parsedSheets.join(', ')}`);
console.log(`Year filter: ${args.year ?? 'none'}\n`);
console.table(result.summary.bySource);
console.log(`Total posts: ${result.summary.total} (ads: ${result.summary.ads}, ideas: ${result.summary.ideas})`);
console.log(`Skipped empty rows: ${result.skipped.length}`);
if (result.warnings.length) {
  console.log(`\nWarnings (${result.warnings.length}):`);
  for (const w of result.warnings) console.log(`  - [${w.sheet}${w.row ? ` r${w.row}` : ''}] ${w.message}`);
}
if (args.verbose) {
  console.log('\nRows:');
  for (const p of result.posts) {
    console.log(`  ${p.date ?? '(idea)    '}  ${p.status.padEnd(12)} ${String(p.pillarName ?? '-').padEnd(26)} ${p.title.slice(0, 60)}  [${p.placements.join(',')}] ${p.approverName ?? ''}`);
  }
}
if (args.json) {
  await fs.writeFile(args.json, JSON.stringify(result, null, 2));
  console.log(`\nWrote ${args.json}`);
}

if (!args.commit) {
  console.log('\nDry run only. Add --commit to write these posts to the database.');
  process.exit(0);
}

const { prisma } = await import('../src/lib/prisma.js');
const { commitImport } = await import('../src/importers/commitImport.js');
try {
  const client = await prisma.client.findUnique({ where: { slug: args.client } });
  if (!client) {
    console.error(`Client with slug "${args.client}" not found. Run the seed first (npm run db:seed).`);
    process.exit(1);
  }
  const out = await commitImport(prisma, { clientId: client.id, posts: result.posts });
  console.log(`\nImported into "${client.name}":`);
  console.log(out);
} finally {
  await prisma.$disconnect();
}
