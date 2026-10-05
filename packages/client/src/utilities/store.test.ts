import { describe, expect, test } from 'bun:test';

import { insertSorted, newestFirst, updateSorted } from '@kogami/client/utilities/store';

interface Row {
  readonly id: string;
  readonly date: string;
  readonly label: string;
}

const normalize = (row: Row): Row => ({ ...row, label: row.label.trim() });

const row = (id: string, date: string, label = id): Row => ({ id, date, label });

describe('insertSorted', () => {
  test('places a row by date descending', () => {
    const rows = insertSorted(insertSorted([row('a', '2026-01-01')], row('c', '2026-03-01'), newestFirst), row('b', '2026-02-01'), newestFirst);

    expect(rows.map((r) => r.id)).toEqual(['c', 'b', 'a']);
  });

  test('puts a newer row ahead of an already sorted array', () => {
    const rows = insertSorted([row('a', '2026-03-01'), row('b', '2026-02-01')], row('c', '2026-06-01'), newestFirst);

    expect(rows.map((r) => r.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('updateSorted', () => {
  const rows = [row('a', '2026-03-01'), row('b', '2026-02-01'), row('c', '2026-01-01')];

  test('returns null when the normalized row is unchanged', () => {
    expect(updateSorted(rows, 'b', { label: 'b' }, normalize, newestFirst)).toBeNull();
  });

  test('returns null for an unknown id', () => {
    expect(updateSorted(rows, 'missing', { label: 'x' }, normalize, newestFirst)).toBeNull();
  });

  test('keeps the position when only a non-sorting field changes', () => {
    const updated = updateSorted(rows, 'b', { label: ' renamed ' }, normalize, newestFirst);

    expect(updated?.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(updated?.[1]?.label).toBe('renamed');
  });

  test('reorders when the date moves past another row', () => {
    const updated = updateSorted(rows, 'c', { date: '2026-04-01' }, normalize, newestFirst);

    expect(updated?.map((r) => r.id)).toEqual(['c', 'a', 'b']);
  });
});
