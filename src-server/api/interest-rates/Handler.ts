import { join } from 'node:path';
import { FileSystem, HttpClient, HttpClientRequest, Path } from '@effect/platform';
import { Effect } from 'effect';
import { DOMParser } from 'linkedom';

import type { ReadonlyRecord } from 'effect/Record';

export const INTEREST_RATES_FILE = join('data', 'interest-rates.json');

export interface InterestRateEntry {
  readonly tags: string;
  readonly rate: number;
}

export interface InterestRateData {
  readonly startDate: string;
  readonly endDate: string;
  readonly entries: InterestRateEntry[];
}

interface Store {
  readonly [range: string]: InterestRateData;
}

const MONTHS: ReadonlyRecord<string, string> = {
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
  if (!date) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }

  return null;
};

const parseDateRange = (text: string) => {
  const match = text.match(/(\d+)\s+(\w+)\s+(\d+)\s+-\s+(\d+)\s+(\w+)\s+(\d+)/);
  if (!match || match.length < 7) {
    return null;
  }

  const sDay = match[1]!;
  const sMonth = match[2]!;
  const sYear = match[3]!;
  const eDay = match[4]!;
  const eMonth = match[5]!;
  const eYear = match[6]!;

  const startMonth = MONTHS[sMonth.toLowerCase()];
  const endMonth = MONTHS[eMonth.toLowerCase()];

  if (!startMonth || !endMonth) {
    return null;
  }

  const start = `${sYear}-${startMonth}-${sDay.padStart(2, '0')}`;
  const end = `${eYear}-${endMonth}-${eDay.padStart(2, '0')}`;

  return { start, end };
};

const scrape = (date: string) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const url = `https://fiskal.kemenkeu.go.id/informasi-publik/tarif-bunga?date=${date}`;

    yield* Effect.logInfo(`Fetching URL: ${url}`);
    const response = yield* HttpClientRequest.get(url).pipe(
      HttpClientRequest.setHeader(
        'User-Agent',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ),
      client.execute,
      Effect.timeout('60 seconds'),
      Effect.flatMap((res) => res.text),
      Effect.catchAll((err) => Effect.fail(err)),
      Effect.scoped,
    );

    const dom = new DOMParser().parseFromString(response, 'text/html');

    const rangeText = dom.querySelector('.text-muted em')?.textContent || '';
    yield* Effect.logInfo(`Range text found: "${rangeText.trim()}"`);
    const range = parseDateRange(rangeText);

    if (!range) {
      return yield* Effect.fail(new Error(`Could not parse date range from: "${rangeText}"`));
    }

    const rows = Array.from(dom.querySelectorAll('table tbody tr'));
    yield* Effect.logInfo(`Found ${rows.length} rows in table`);
    const entries: InterestRateEntry[] = rows.map((row: any) => {
      const tags = row.querySelector('td.text-left')?.textContent?.trim() || '';
      const rateText = row.querySelector('td:last-child')?.textContent?.trim() || '0';
      // Extract rate: "0,53% (nol koma lima tiga persen)" -> "0,53"
      const rateMatch = rateText.match(/([\d,]+)%/);
      const rateRaw = rateMatch ? rateMatch[1] : '0';
      const rate = parseFloat(rateRaw!.replace(',', '.'));
      return { tags, rate };
    });

    return {
      startDate: range.start,
      endDate: range.end,
      entries,
    };
  });

const getStore = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;

  const exists = yield* fs.exists(INTEREST_RATES_FILE);

  if (!exists) {
    return {};
  }

  const content = yield* fs.readFileString(INTEREST_RATES_FILE);
  try {
    return JSON.parse(content) as Store;
  } catch (e) {
    return {};
  }
});

const saveStore = (store: Store) =>
  Effect.gen(function* () {
    yield* Effect.logInfo(`Saving store to ${INTEREST_RATES_FILE}...`);

    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const dir = path.dirname(INTEREST_RATES_FILE);
    const exists = yield* fs.exists(dir);

    if (!exists) {
      yield* fs.makeDirectory(dir, { recursive: true });
    }

    const sortedStore: Store = Object.keys(store)
      .sort((a, b) => b.localeCompare(a))
      .reduce((acc, key) => {
        acc[key] = store[key]!;
        return acc;
      }, {} as any);

    yield* fs.writeFileString(INTEREST_RATES_FILE, JSON.stringify(sortedStore));
  });

export const getOrScrape = (date: string) =>
  Effect.gen(function* () {
    const store = yield* getStore;

    const existing = Object.values(store).find((data) => {
      const isDateInRange = date >= data.startDate && date <= data.endDate;
      if (!isDateInRange) return false;

      return true;
    });

    if (existing) {
      yield* Effect.logInfo(`Using cached data ${existing.startDate} to ${existing.endDate}`);
      return existing;
    }

    yield* Effect.logInfo(`Data for ${date} not found, scraping...`);
    const data = yield* scrape(date);

    const rangeKey = `${data.startDate}_${data.endDate}`;

    let updatedStore = { ...store };
    updatedStore[rangeKey] = data;
    yield* saveStore(updatedStore);

    return data;
  });
