import type { ReadonlyRecord } from 'effect/Record';

const MONTHS_MAP: ReadonlyRecord<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
  januari: '01',
  februari: '02',
  maret: '03',
  april: '04',
  mei: '05',
  juni: '06',
  juli: '07',
  agustus: '08',
  september: '09',
  oktober: '10',
  november: '11',
  desember: '12',
};

export const normalizeDate = (date: string | null): string | null => {
  if (!date) return null;

  const match = date.match(/^(\w{3}),\s+(\w{3})\s+(\d{1,2}),\s+(\d{4})$/);
  if (match) {
    const month = MONTHS_MAP[match[2]!.toLowerCase()];
    if (month) return `${match[4]}-${month}-${match[3]!.padStart(2, '0')}`;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
};

export const parseDateRange = (text: string) => {
  const match = text.match(/(\d+)\s+(\w+)\s+(\d+)\s+-\s+(\d+)\s+(\w+)\s+(\d+)/);
  if (!match) return null;

  const startMonth = MONTHS_MAP[match[2]!.toLowerCase()];
  const endMonth = MONTHS_MAP[match[5]!.toLowerCase()];

  if (!startMonth || !endMonth) return null;

  return {
    start: `${match[3]}-${startMonth}-${match[1]!.padStart(2, '0')}`,
    end: `${match[6]}-${endMonth}-${match[4]!.padStart(2, '0')}`,
  };
};

const MS_PER_DAY = 86_400_000;

export const getDayDiff = (start: string, end: string): number => {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Math.round((e - s) / MS_PER_DAY) + 1;
};
