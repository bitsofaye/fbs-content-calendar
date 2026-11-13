import { describe, expect, it } from 'vitest';
import { parseContentCsv, parseCsvText } from '../src/importers/csvImport.js';

const HEAD = 'Date,Time,Pillar / Service,Topic,Type,Platforms,Status,Approver,Format,Story board,Caption,Hashtags,Pubmat links,Remarks';

describe('parseCsvText', () => {
  it('handles quotes, commas and line breaks inside cells, and a BOM', () => {
    const rows = parseCsvText('﻿a,b\r\n"x, y","line 1\nline ""2"""\r\n');
    expect(rows).toEqual([['a', 'b'], ['x, y', 'line 1\nline "2"']]);
  });
  it('detects semicolon-separated files', () => {
    expect(parseCsvText('a;b\n1;2')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('parseContentCsv', () => {
  it('rejects a file missing required headings and names them', () => {
    expect(() => parseContentCsv('Topic,Date\nx,2026-01-01')).toThrow(/Missing headings: Time, Pillar \/ Service/);
  });

  it('accepts empty columns; only Topic needs a value', () => {
    const r = parseContentCsv(`${HEAD}\n,,,Just a topic,,,,,,,,,,\n,,,,,,,,,,,,,\n`);
    expect(r.posts).toHaveLength(1);
    expect(r.posts[0]).toMatchObject({ title: 'Just a topic', date: null, status: 'IDEA', kind: 'ORGANIC' });
  });

  it('maps dates, times, platforms, status, type and hashtags', () => {
    const r = parseContentCsv(
      `${HEAD},Day\n12/01/2026,9:30 PM,FBS,Promo,Ad,"Facebook Post, IG Reels; TikTok",For approval,Ms. Ayeca,Carousel,,Buy now #fbs #promo,,https://a.b/c https://d.e/f,Note,Tue\n`,
    );
    expect(r.posts[0]).toMatchObject({
      date: '2026-12-01',
      time: '21:30',
      pillarName: 'FBS-Company',
      kind: 'AD',
      status: 'FOR_APPROVAL',
      placements: ['FB_POST', 'IG_REELS', 'TIKTOK'],
      approverName: 'Ms. Ayeca',
      caption: 'Buy now',
      hashtags: '#fbs #promo',
      pubmatLinks: ['https://a.b/c', 'https://d.e/f'],
    });
    expect(r.warnings).toHaveLength(0);
  });

  it('warns about values it cannot read and gives stable keys for re-imports', () => {
    const csv = `${HEAD}\nsomeday,25:00,,Same,,Fax,Weird,,,,,,,\n2026-02-03,,,Same,,,,,,,,,,\n2026-02-03,,,Same,,,,,,,,,,\n`;
    const r = parseContentCsv(csv);
    expect(r.warnings.map((w) => w.row)).toEqual([2, 2, 2, 2]);
    expect(r.posts.map((p) => p.importSource)).toEqual(['csv:idea:same', 'csv:2026-02-03:same', 'csv:2026-02-03:same#2']);
    expect(parseContentCsv(csv).posts.map((p) => p.importSource)).toEqual(r.posts.map((p) => p.importSource));
  });
});
