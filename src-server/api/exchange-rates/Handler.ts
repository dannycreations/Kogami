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

  // Handling Indonesian month names if they appear
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

    // Sort keys descending so newest ranges are at the top
    const sortedStore: Store = Object.keys(store)
      .sort((a, b) => b.localeCompare(a))
      .reduce((acc, key) => {
        acc[key] = store[key]!;
        return acc;
      }, {} as any);

    yield* fs.writeFileString(DATA_FILE, JSON.stringify(sortedStore));
  });

export const getOrScrape = (date: string) =>
  Effect.gen(function* () {
    const store = yield* getStore;

    const existing = Object.values(store).find((data) => {
      const isDateInRange = date >= data.startDate && date <= data.endDate;
      if (!isDateInRange) return false;

      const rangeDuration = (new Date(data.endDate).getTime() - new Date(data.startDate).getTime()) / (1000 * 60 * 60 * 24) + 1;

      // If the date is in the past or present, we want the shortest possible range (usually 7 days)
      // Long ranges are only acceptable for future dates where short ranges don't exist yet.
      const today = new Date().toISOString().split('T')[0];
      // Force refresh if the range is long AND (it covers past/present date OR the date we want is past/present)
      if (rangeDuration > 7 && (today >= data.startDate || date <= today)) {
        return false;
      }

      return true;
    });

    if (existing) {
      yield* Effect.logInfo(`Using cached data ${existing.startDate} to ${existing.endDate}`);
      return existing;
    }

    yield* Effect.logInfo(`Data for ${date} not found, scraping...`);
    const data = yield* scrape(date);

    const rangeKey = `${data.startDate}_${data.endDate}`;
    const rangeDuration = (new Date(data.endDate).getTime() - new Date(data.startDate).getTime()) / (1000 * 60 * 60 * 24) + 1;

    let updatedStore = { ...store };

    // If we just scraped a 7-day range, and there's a longer range that contains it,
    // we should remove the longer range as it's now redundant/obsolete.
    if (rangeDuration <= 7) {
      for (const [key, existingData] of Object.entries(store)) {
        if (data.startDate >= existingData.startDate && data.endDate <= existingData.endDate && key !== rangeKey) {
          const existingDuration =
            (new Date(existingData.endDate).getTime() - new Date(existingData.startDate).getTime()) / (1000 * 60 * 60 * 24) + 1;
          if (existingDuration > rangeDuration) {
            yield* Effect.logInfo(`Removing redundant longer range: ${key}`);
            delete updatedStore[key];
          }
        }
      }
    }

    updatedStore[rangeKey] = data;
    yield* saveStore(updatedStore);

    return data;
  });
