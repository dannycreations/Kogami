import { describe, expect, test } from 'bun:test';

import { addDays, findFirstUncoveredDate } from '@kogami/server/utilities/date';

describe('findFirstUncoveredDate', () => {
  const ranges = [
    { startDate: '2026-04-01', endDate: '2026-04-07' },
    { startDate: '2026-04-15', endDate: '2026-04-21' },
  ];

  test('returns the first day no range covers, ignoring range order', () => {
    expect(findFirstUncoveredDate([...ranges].reverse(), '2026-04-01', '2026-04-30')).toBe('2026-04-08');
  });

  test('reports a fully covered span as null', () => {
    expect(findFirstUncoveredDate(ranges, '2026-04-01', '2026-04-07')).toBeNull();
  });

  test('walks across month boundaries', () => {
    expect(findFirstUncoveredDate(ranges, '2026-03-31', '2026-04-01')).toBe('2026-03-31');
  });
});

describe('addDays', () => {
  test('moves in both directions across month boundaries', () => {
    expect(addDays('2026-03-31', 1)).toBe('2026-04-01');
    expect(addDays('2026-04-01', -1)).toBe('2026-03-31');
    expect(addDays('2026-04-01', 0)).toBe('2026-04-01');
  });
});
