export const binarySearchIndex = <T>(array: readonly T[], compare: (item: T) => number): number => {
  let low = 0;
  let high = array.length - 1;

  while (low <= high) {
    const mid = (low + high) >>> 1;
    const cmp = compare(array[mid]!);

    if (cmp === 0) return mid;
    if (cmp < 0) {
      low = mid + 1;
    } else {
      high = mid - 1;
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

  // Check for deep equality to avoid unnecessary state updates
  // Only checking specific fields might be brittle, so we do a shallow check of normalized objects
  const keys = Object.keys(updated) as (keyof T)[];
  let changed = false;
  for (const key of keys) {
    if (updated[key] !== oldItem[key]) {
      changed = true;
      break;
    }
  }

  if (!changed) return null;

  const next = [...array];
  // If the sorting criteria didn't change (e.g. date didn't change), just replace in-place
  if (compare(updated, oldItem) === 0) {
    next[index] = updated;
    return next;
  }

  // Otherwise, remove and re-insert at correct position
  next.splice(index, 1);
  const insertIdx = binarySearchIndex(next, (item) => compare(updated, item));
  next.splice(insertIdx, 0, updated);
  return next;
};
