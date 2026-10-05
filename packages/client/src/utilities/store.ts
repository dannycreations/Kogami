export const newestFirst = <T extends { id: string; date: string }>(a: T, b: T) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id);

const binarySearchIndex = <T>(array: readonly T[], compare: (candidate: T) => number): number => {
  let low = 0;
  let high = array.length - 1;

  while (low <= high) {
    const mid = (low + high) >>> 1;
    const cmp = compare(array[mid]!);

    if (cmp === 0) return mid;
    if (cmp < 0) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return low;
};

export const insertSorted = <T>(array: readonly T[], item: T, compare: (a: T, b: T) => number): T[] => {
  const next = [...array];
  const index = binarySearchIndex(next, (existing) => compare(item, existing));
  next.splice(index, 0, item);
  return next;
};

export const updateSorted = <T extends { id: string }>(
  array: readonly T[],
  id: string,
  updates: Partial<T>,
  normalize: (item: T) => T,
  compare: (a: T, b: T) => number,
): T[] | null => {
  const index = array.findIndex((item) => item.id === id);
  if (index === -1) return null;

  const oldItem = array[index]!;
  const updated = normalize({ ...oldItem, ...updates });

  // An edit that normalizes back to the same row must not produce a new array,
  // otherwise every keystroke re-renders the table.
  const keys = Object.keys(updated) as (keyof T)[];
  if (!keys.some((key) => updated[key] !== oldItem[key])) return null;

  const next = [...array];
  if (compare(updated, oldItem) === 0) {
    next[index] = updated;
    return next;
  }

  next.splice(index, 1);
  const insertIdx = binarySearchIndex(next, (item) => compare(updated, item));
  next.splice(insertIdx, 0, updated);
  return next;
};
