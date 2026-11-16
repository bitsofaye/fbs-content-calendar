import { describe, expect, it } from 'vitest';
import { readPastedReply, targetDates, toDrafts } from '../src/lib/contentGenerator.js';

// 2026-11-16 is a Monday
const pillars = [
  { name: 'Motivational Monday', weekday: 1 },
  { name: 'Tips Thursday', weekday: 4 },
  { name: 'Any day', weekday: null },
];

describe('targetDates', () => {
  it('returns every day of the range', () => {
    expect(targetDates({ from: '2026-11-16', to: '2026-11-22', days: 'every', pillars })).toHaveLength(7);
  });

  it('skips Saturday and Sunday for weekdays only', () => {
    expect(targetDates({ from: '2026-11-16', to: '2026-11-22', days: 'weekdays', pillars })).toEqual([
      '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20',
    ]);
  });

  it('keeps only the weekdays that have a pillar slot', () => {
    expect(targetDates({ from: '2026-11-16', to: '2026-11-22', days: 'pillar', pillars })).toEqual(['2026-11-16', '2026-11-19']);
  });

  it('handles a single day and month ends', () => {
    expect(targetDates({ from: '2026-11-30', to: '2026-11-30', days: 'every', pillars })).toEqual(['2026-11-30']);
    expect(targetDates({ from: '2026-11-29', to: '2026-12-01', days: 'every', pillars })).toEqual(['2026-11-29', '2026-11-30', '2026-12-01']);
  });
});

describe('reading a reply pasted from claude.ai', () => {
  const reply = `Here are your posts!

\`\`\`json
{
  "posts": [
    { "date": "2026-11-16", "pillar": "motivational monday", "placements": ["FB_POST", "TIKTOK"], "format": "Graphic",
      "title": "Start strong", "caption": "New week, new wins.", "hashtags": "#Monday", "graphicsIdea": "Sunrise", "storyboard": "" },
    { "date": "2026-11-30", "pillar": null, "title": "Outside the period" }
  ]
}
\`\`\`
Let me know if you want changes.`;

  it('finds the JSON inside the chat text', () => {
    expect(readPastedReply(reply).posts).toHaveLength(2);
  });

  it('accepts a bare JSON array too', () => {
    expect(readPastedReply('[{"date":"2026-11-16","title":"A"}]').posts[0].title).toBe('A');
  });

  it('explains when nothing usable was pasted', () => {
    expect(() => readPastedReply('Sure, here you go')).toThrow(/Could not find/);
    expect(() => readPastedReply('```json\n{"posts":[{"date":"2026-11-16"\n```')).toThrow();
  });

  it('keeps only the asked dates, links pillars by name and limits platforms', () => {
    const drafts = toDrafts(readPastedReply(reply), {
      pillars: [{ id: 'p1', name: 'Motivational Monday' }],
      dates: ['2026-11-16'],
      opts: { placements: ['FB_POST', 'IG_POST'] },
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({ pillarId: 'p1', placements: ['FB_POST'], title: 'Start strong', storyboard: null });
  });
});
