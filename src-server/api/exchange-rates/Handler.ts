import { join } from 'node:path';
import { FileSystem, HttpClient, HttpClientRequest, Path } from '@effect/platform';
import { Effect } from 'effect';
import { DOMParser } from 'linkedom';

import type { ReadonlyRecord } from 'effect/Record';

const DATA_FILE = join('data', 'exchange-rates.json');

export interface ExchangeRateEntry {
  readonly currency: string;
  readonly rate: number;
}

export interface ExchangeRateData {
  readonly startDate: string;
  readonly endDate: string;
  readonly entries: ExchangeRateEntry[];
}

interface Store {
  readonly [range: string]: ExchangeRateData;
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
};

export const normalizeDate = (date: string | null): string | null => {
  if (!date) {
    return null;
  }

  let normalized = date;
  if (/^\w{3},\s+\w{3}\s+\d{1,2},\s+\d{4}$/.test(date)) {
    const match = date.match(/^\w{3},\s+(\w{3})\s+(\d{1,2}),\s+(\d{4})$/);
    if (match && MONTHS[match[1]?.toLowerCase()]) {
      const [, month, day, year] = match;
      normalized = `${year}-${MONTHS[month.toLowerCase()]}-${day.padStart(2, '0')}`;
    }
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  return null;
};

const parseDateRange = (text: string) => {
  const match = text.match(/(\d+)\s+(\w+)\s+(\d+)\s+-\s+(\d+)\s+(\w+)\s+(\d+)/);
  if (!match) {
    return null;
  }

  const [, sDay, sMonth, sYear, eDay, eMonth, eYear] = match;

  const start = `${sYear}-${MONTHS[sMonth.slice(0, 3).toLowerCase()]}-${sDay.padStart(2, '0')}`;
  const end = `${eYear}-${MONTHS[eMonth.slice(0, 3).toLowerCase()]}-${eDay.padStart(2, '0')}`;

  return { start, end };
};

const scrape = (date: string) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const url = `https://fiskal.kemenkeu.go.id/informasi-publik/kurs-pajak?date=${date}`;

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
    const entries: ExchangeRateEntry[] = rows.map((row: any) => {
      const currencyFull = row.querySelector('td:nth-child(2) .hidden-xs')?.textContent?.trim() || '';
      const currency = currencyFull.match(/\(([^)]+)\)/)?.[1] || currencyFull;
      const rateText = row.querySelector('td:nth-child(3) .m-l-5')?.textContent?.trim() || '0';
      const rate = parseFloat(rateText.replace(/\./g, '').replace(',', '.'));
      return { currency, rate };
    });

    return {
      startDate: range.start,
      endDate: range.end,
      entries,
    };
  });

const getStore = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;

  const exists = yield* fs.exists(DATA_FILE);

  if (!exists) {
    return {};
  }

  const content = yield* fs.readFileString(DATA_FILE);
  try {
    return JSON.parse(content) as Store;
  } catch (e) {
    return {};
  }
});

const saveStore = (store: Store) =>
  Effect.gen(function* () {
    yield* Effect.logInfo(`Saving store to ${DATA_FILE}...`);

    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const dir = path.dirname(DATA_FILE);
    const exists = yield* fs.exists(dir);

    if (!exists) {
      yield* fs.makeDirectory(dir, { recursive: true });
    }

    yield* fs.writeFileString(DATA_FILE, JSON.stringify(store));
  });

export const getOrScrape = (date: string) =>
  Effect.gen(function* () {
    const store = yield* getStore;

    const existing = Object.values(store).find((data) => date >= data.startDate && date <= data.endDate);

    if (existing) {
      yield* Effect.logInfo(`Using cached data ${existing.startDate} to ${existing.endDate}`);
      return existing;
    }

    yield* Effect.logInfo(`Data for ${date} not found, scraping...`);
    const data = yield* scrape(date);

    const rangeKey = `${data.startDate}_${data.endDate}`;
    const updatedStore = { ...store, [rangeKey]: data };
    yield* saveStore(updatedStore);

    return data;
  });
