import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import {
  canonicalPillar, guessCompanyPillar, mapPlacements, mapStatus, parseFbsWorkbook, splitCaption, toISODate,
} from '../src/importers/fbsWorkbook.js';
import { approverToken, matchApprover } from '../src/importers/commitImport.js';

const d = (iso) => new Date(`${iso}T00:00:00.000Z`);

async function buildWorkbook() {
  const wb = new ExcelJS.Workbook();

  // Same layout as the real "Content proposals" sheet (header on row 2, data from column B)
  const cp = wb.addWorksheet('Content proposals ');
  cp.getRow(2).values = [null, 'SERVICE', 'DATE', 'TOPIC', 'PLATFORMS', 'STATUS', 'Approver', 'Content Story Board', '', 'PUBMATS LINK', 'REMARKS', 'PUBMATS', 'Reference Link (Original Source of bite content)', 'Title Draft/Thumbnail', 'Caption and Hastags Draft (If needed on the post)'];
  cp.getRow(3).values = ['FEBRUARY', 'Social Media Management', d('2026-02-28'), 'Why plan your posts', 'Facebook Post, Instagram Post, FB Reels, YT Shorts, TikTok', 'Approved', 'Ms. Ayeca', 'Hook first', '', 'https://drive.google.com/x', 'Looks good', 'Short clips/ Videos', '', '', 'Plan ahead! #SMM #FBS'];
  cp.getRow(4).values = ['', 'Local Accounting', d('2025-12-15'), 'Old 2025 post', 'Facebook Post', 'Published', 'Sir Carlo'];
  cp.getRow(5).values = ['', 'FBS', 46045, '', 'Facebook Post', 'Scheduled', '', 'Sir Carlo']; // serial date 2026-01-23, approver typed in storyboard col
  cp.getRow(6).values = ['', '', d('2026-03-01')]; // empty row with only a date → skipped
  cp.getRow(7).values = ['', 'Motivational Monday', d('2026-03-02'), 'Monday quote', 'Facebook Post', 'Weird status', 'Sir Jhonny'];

  const ca = wb.addWorksheet('Contents for Approval');
  ca.getRow(2).values = ['WEEK', 'CHANNEL 1', 'CHANNEL 2', 'CHANNEL 3', 'CHANNEL 4', 'Date', 'DAY OF WEEK', 'STATUS', 'Approver', 'TOPIC/POST', 'PUBMAT (Visual or Link)', 'Caption', 'HASHTAGS', 'REACTS', 'COMMENTS', 'SHARE', 'REACH', 'ENGAGEMENT', 'LINK CLICKS', 'FEEDBACK', 'REMARKS'];
  ca.getRow(3).values = [1, 'Facebook', 'Instagram', 'LinkedIn', '', d('2026-02-03'), 'Tuesday', 'Published', 'Sir Carlo', 'January Company Fellowship', 'https://drive.google.com/y', 'Starting the year right!', '#Fellowship', 41, 1, 21, 1749, 273, 1, 'Excellent', 'Tag the team'];

  const ads = wb.addWorksheet('Ads for Approval');
  ads.getRow(1).values = ['', 'SERVICE', 'DATE', 'TOPIC', 'PLATFORMS', 'STATUS', 'Approver', '', '', 'PUBMATS LINK', 'REMARKS', 'PUBMATS', 'Primary Text', '', 'Targeting (AdSet1)', 'Targeting (AdSet2)', 'Targeting (AdSet3)', 'Botcake Message'];
  ads.getRow(2).values = ['', 'Local Accounting', d('2026-02-24'), '', 'Facebook Post, Facebook Ads', 'Approved', 'Sir Carlo', '', '', '02-20-2026', '', '', 'Magulo pa rin ba ang papers mo?', 'Headline: Free Guide\nDescription: For San Pablo owners\nCTA: Send Message', 'Location: San Pablo', 'Accounting', 'Local business', 'bc-msg1'];
  ads.getRow(3).values = ['', 'Local Accounting', null, '', 'Facebook Post', '', 'Sir Carlo']; // empty template row

  const ideas = wb.addWorksheet('Contents');
  ideas.getRow(1).values = ['LCSS', 'WEB', 'VA'];
  ideas.getCell('A2').value = 'Perks of choosing FBS in your OJT';
  ideas.getCell('B2').value = 'Why regular website maintenance?';
  ideas.mergeCells('B2:B3'); // merged cells must not produce duplicates
  ideas.getCell('C2').value = '"Who needs a VA?"';

  wb.addWorksheet('SMM Content Calendar'); // ignored grid sheet
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('value helpers', () => {
  it('parses dates in all workbook forms', () => {
    expect(toISODate(d('2026-02-24'))).toBe('2026-02-24');
    expect(toISODate(46077)).toBe('2026-02-24');
    expect(toISODate('02-20-2026')).toBe('2026-02-20');
    expect(toISODate('2026-1-5')).toBe('2026-01-05');
    expect(toISODate('Examples')).toBeNull();
    expect(toISODate(3)).toBeNull();
  });

  it('maps the status dropdown', () => {
    expect(mapStatus('For approval').status).toBe('FOR_APPROVAL');
    expect(mapStatus('In progress').status).toBe('IN_PROGRESS');
    expect(mapStatus('To Edit').status).toBe('TO_EDIT');
    expect(mapStatus('-----------------').status).toBeNull();
    expect(mapStatus('Weird').unknown).toBe('Weird');
  });

  it('maps platforms and channels to placements', () => {
    expect(mapPlacements(['Facebook Post, Instagram Post, LinkedIn Post']).placements).toEqual(['FB_POST', 'IG_POST', 'LINKEDIN_POST']);
    expect(mapPlacements(['YT Shorts, TikTok, IG Reels, FB Reels']).placements).toEqual(['YT_SHORTS', 'TIKTOK', 'IG_REELS', 'FB_REELS']);
    expect(mapPlacements(['Facebook', 'Stories', 'Shorts', 'Website']).unknown).toEqual(['Website']);
  });

  it('splits trailing hashtags off a caption', () => {
    expect(splitCaption('Hello world!\n\n#FBS #Business')).toEqual({ caption: 'Hello world!', hashtags: '#FBS #Business' });
    expect(splitCaption('Use #FBS in the middle of text.')).toEqual({ caption: 'Use #FBS in the middle of text.', hashtags: null });
    expect(splitCaption('#only #tags')).toEqual({ caption: null, hashtags: '#only #tags' });
  });

  it('normalizes pillar names and guesses company categories', () => {
    expect(canonicalPillar('FBS')).toBe('FBS-Company');
    expect(canonicalPillar('LCSS')).toBe('Learning Center Solutions');
    expect(canonicalPillar('Motivational Monday')).toBe('Motivational Monday');
    expect(guessCompanyPillar('Birthday Greetings for Sir Jeff')).toBe('Birthday/Work Anniversary Postings');
    expect(guessCompanyPillar('February Company Fellowship Reels')).toBe('Company Fellowships');
    expect(guessCompanyPillar('PCCI Job Fair')).toBe('Company Events');
    expect(guessCompanyPillar('Natessa Villa')).toBeNull();
  });

  it('matches sheet approver names to users', () => {
    const users = [{ id: '1', name: 'Carlo Del Monte', role: 'ADMIN' }, { id: '2', name: 'Jhonny Jose Dichoso', role: 'ADMIN' }];
    expect(approverToken('Sir Carlo')).toBe('carlo');
    expect(matchApprover('Sir Carlo', users)?.id).toBe('1');
    expect(matchApprover('Sir Jhonny', users)?.id).toBe('2');
    expect(matchApprover('Ms. Ayeca', users)).toBeNull();
  });
});

describe('parseFbsWorkbook', () => {
  it('reads only the requested year from the table sheets', async () => {
    const res = await parseFbsWorkbook(await buildWorkbook(), { year: 2026 });
    expect(res.summary.parsedSheets).toEqual(['Content proposals', 'Contents for Approval', 'Ads for Approval', 'Contents']);
    expect(res.summary.bySource).toEqual({ 'Content proposals': 3, 'Contents for Approval': 1, 'Ads for Approval': 1, Contents: 3 });
    expect(res.posts.every((p) => p.date === null || p.date.startsWith('2026'))).toBe(true);
    expect(res.skipped).toHaveLength(1);
  });

  it('maps a Content proposals row', async () => {
    const res = await parseFbsWorkbook(await buildWorkbook(), { year: 2026 });
    const p = res.posts.find((x) => x.date === '2026-02-28');
    expect(p).toMatchObject({
      title: 'Why plan your posts',
      pillarName: 'Social Media Management',
      status: 'APPROVED',
      placements: ['FB_POST', 'IG_POST', 'FB_REELS', 'YT_SHORTS', 'TIKTOK'],
      approverName: 'Ms. Ayeca',
      storyboard: 'Hook first',
      caption: 'Plan ahead!',
      hashtags: '#SMM #FBS',
      format: 'Short clips/ Videos',
      pubmatLinks: ['https://drive.google.com/x'],
      importSource: 'Content proposals!r3',
    });
  });

  it('handles serial dates, shifted approver, fallback titles and unknown statuses', async () => {
    const res = await parseFbsWorkbook(await buildWorkbook(), { year: 2026 });
    const jan = res.posts.find((x) => x.date === '2026-01-23');
    expect(jan).toMatchObject({ pillarName: 'FBS-Company', approverName: 'Sir Carlo', title: 'FBS-Company post', storyboard: null });
    const mar = res.posts.find((x) => x.date === '2026-03-02');
    expect(mar.status).toBe('IN_PROGRESS');
    expect(res.warnings.some((w) => w.message.includes('Weird status'))).toBe(true);
  });

  it('keeps metrics from Contents for Approval', async () => {
    const res = await parseFbsWorkbook(await buildWorkbook(), { year: 2026 });
    const p = res.posts.find((x) => x.source === 'Contents for Approval');
    expect(p).toMatchObject({
      pillarName: 'Company Fellowships', placements: ['FB_POST', 'IG_POST', 'LINKEDIN_POST'], reacts: 41, reach: 1749, engagement: 273, feedback: 'EXCELLENT', hashtags: '#Fellowship',
    });
  });

  it('reads ads with copy and ad sets, ignoring empty template rows', async () => {
    const res = await parseFbsWorkbook(await buildWorkbook(), { year: 2026 });
    const ads = res.posts.filter((x) => x.kind === 'AD');
    expect(ads).toHaveLength(1);
    expect(ads[0].adDetails).toMatchObject({ headline: 'Free Guide', description: 'For San Pablo owners', cta: 'Send Message', botcakeMessage: 'bc-msg1' });
    expect(ads[0].adDetails.adSets).toHaveLength(3);
    expect(ads[0].title).toBe('Magulo pa rin ba ang papers mo?');
  });

  it('turns the idea bank into undated ideas without merged duplicates', async () => {
    const res = await parseFbsWorkbook(await buildWorkbook(), { year: 2026 });
    const ideas = res.posts.filter((x) => x.status === 'IDEA');
    expect(ideas.map((i) => i.title).sort()).toEqual(['Perks of choosing FBS in your OJT', 'Who needs a VA?', 'Why regular website maintenance?']);
    expect(ideas.find((i) => i.title.startsWith('Who')).pillarName).toBe('Virtual Assistance');
    const noIdeas = await parseFbsWorkbook(await buildWorkbook(), { year: 2026, includeIdeas: false });
    expect(noIdeas.posts.some((x) => x.status === 'IDEA')).toBe(false);
  });

  it('without a year filter it keeps every dated row', async () => {
    const res = await parseFbsWorkbook(await buildWorkbook());
    expect(res.posts.some((p) => p.date === '2025-12-15')).toBe(true);
  });
});
