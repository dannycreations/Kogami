import { join } from 'node:path';
import { FileSystem, HttpClient, HttpClientRequest, Path } from '@effect/platform';
import { Effect } from 'effect';
import { DOMParser } from 'linkedom';

const DATA_FILE = join('data', 'kurs-pajak.json');

interface KursEntry {
  readonly mataUang: string;
  readonly nilai: number;
}

interface KursData {
  readonly startDate: string;
  readonly endDate: string;
  readonly entries: KursEntry[];
}

interface Store {
  readonly [range: string]: KursData;
}

const parseDateRange = (text: string) => {
  const months: Record<string, string> = {
    Januari: '01',
    Februari: '02',
    Maret: '03',
    April: '04',
    Mei: '05',
    Juni: '06',
    Juli: '07',
    Agustus: '08',
    September: '09',
    Oktober: '10',
    November: '11',
    Desember: '12',
  };

  const match = text.match(/(\d+)\s+(\w+)\s+(\d+)\s+-\s+(\d+)\s+(\w+)\s+(\d+)/);
  if (!match) {
    return null;
  }

  const [, sDay, sMonth, sYear, eDay, eMonth, eYear] = match;

  const start = `${sYear}-${months[sMonth]}-${sDay.padStart(2, '0')}`;
  const end = `${eYear}-${months[eMonth]}-${eDay.padStart(2, '0')}`;

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
    const document: HTMLDocument = (dom as any).document || dom;

    const rangeText = document.querySelector('.text-muted em')?.textContent || '';
    yield* Effect.logInfo(`Range text found: "${rangeText.trim()}"`);
    const range = parseDateRange(rangeText);

    if (!range) {
      return yield* Effect.fail(new Error(`Could not parse date range from: "${rangeText}"`));
    }

    const rows = Array.from(document.querySelectorAll('table tbody tr'));
    yield* Effect.logInfo(`Found ${rows.length} rows in table`);
    const entries: KursEntry[] = rows.map((row: any) => {
      const mataUangFull = row.querySelector('td:nth-child(2) .hidden-xs')?.textContent?.trim() || '';
      const mataUang = mataUangFull.match(/\(([^)]+)\)/)?.[1] || mataUangFull;
      const nilaiText = row.querySelector('td:nth-child(3) .m-l-5')?.textContent?.trim() || '0';
      const nilai = parseFloat(nilaiText.replace(/\./g, '').replace(',', '.'));
      return { mataUang, nilai };
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
      yield* Effect.logInfo(`Using cached data for ${date} [${existing.startDate} to ${existing.endDate}]`);
      return existing;
    }

    yield* Effect.logInfo(`Data for ${date} not found, scraping...`);
    const data = yield* scrape(date);

    const rangeKey = `${data.startDate}_${data.endDate}`;
    const updatedStore = { ...store, [rangeKey]: data };
    yield* saveStore(updatedStore);

    return data;
  });
