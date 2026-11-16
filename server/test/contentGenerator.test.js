import { describe, expect, it } from 'vitest';
import { targetDates } from '../src/lib/contentGenerator.js';

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
