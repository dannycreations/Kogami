import {
  FetchHttpClient,
  FileSystem,
  HttpClient,
  HttpClientRequest,
  HttpRouter,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse,
  Path,
} from '@effect/platform';
import { BunFileSystem, BunHttpServer, BunPath } from '@effect/platform-bun';
import { Console, Effect, Layer } from 'effect';
import { DOMParser } from 'linkedom';

const DATA_FILE = 'data/kurs-pajak.json';

interface KursEntry {
  mataUang: string;
  nilai: number;
}

interface KursData {
  startDate: string;
  endDate: string;
  entries: KursEntry[];
}

interface Store {
  [range: string]: KursData;
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
  if (!match) return null;

  const [, sDay, sMonth, sYear, eDay, eMonth, eYear] = match;

  const start = `${sYear}-${months[sMonth]}-${sDay.padStart(2, '0')}`;
  const end = `${eYear}-${months[eMonth]}-${eDay.padStart(2, '0')}`;

  return { start, end };
};

const scrape = (date: string) =>
  Effect.gen(function* (_) {
    const client = yield* _(HttpClient.HttpClient);
    const url = `https://fiskal.kemenkeu.go.id/informasi-publik/kurs-pajak?date=${date}`;

    const response = yield* _(
      HttpClientRequest.get(url),
      client.execute,
      Effect.flatMap((res) => res.text),
      Effect.scoped,
    );

    const { document } = new DOMParser().parseFromString(response, 'text/html') as any;

    const rangeText = document.querySelector('.text-muted em')?.textContent || '';
    const range = parseDateRange(rangeText);

    if (!range) {
      return yield* _(Effect.fail(new Error('Could not parse date range from page')));
    }

    const rows = Array.from(document.querySelectorAll('table tbody tr'));
    const entries: KursEntry[] = rows.map((row: any) => {
      const mataUang = row.querySelector('td:nth-child(2) .hidden-xs')?.textContent?.trim() || '';
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

const getStore = Effect.gen(function* (_) {
  const fs = yield* _(FileSystem.FileSystem);
  const exists = yield* _(fs.exists(DATA_FILE));
  if (!exists) return {};
  const content = yield* _(fs.readFileString(DATA_FILE));
  try {
    return JSON.parse(content) as Store;
  } catch {
    return {};
  }
});

const saveStore = (store: Store) =>
  Effect.gen(function* (_) {
    const fs = yield* _(FileSystem.FileSystem);
    const path = yield* _(Path.Path);
    const dir = path.dirname(DATA_FILE);
    const exists = yield* _(fs.exists(dir));
    if (!exists) {
      yield* _(fs.makeDirectory(dir, { recursive: true }));
    }
    yield* _(fs.writeFileString(DATA_FILE, JSON.stringify(store, null, 2)));
  });

const getOrScrape = (date: string) =>
  Effect.gen(function* (_) {
    const store = yield* _(getStore);

    const existing = Object.values(store).find((data) => date >= data.startDate && date <= data.endDate);

    if (existing) {
      yield* _(Console.log(`Data for ${date} found in cache (${existing.startDate} to ${existing.endDate})`));
      return existing;
    }

    yield* _(Console.log(`Data for ${date} not found, scraping...`));
    const data = yield* _(scrape(date));

    const rangeKey = `${data.startDate}_${data.endDate}`;
    const updatedStore = { ...store, [rangeKey]: data };
    yield* _(saveStore(updatedStore));

    return data;
  });

const router = HttpRouter.empty.pipe(
  HttpRouter.get(
    '/kurs',
    Effect.gen(function* (_) {
      const request = yield* _(HttpServerRequest.HttpServerRequest);
      const url = new URL(request.url, 'http://localhost');
      const date = url.searchParams.get('date');

      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return yield* _(HttpServerResponse.json({ error: 'Invalid or missing date parameter (YYYY-MM-DD)' }, { status: 400 }));
      }

      const data = yield* _(getOrScrape(date));
      return yield* _(HttpServerResponse.json(data));
    }),
  ),
);

const HttpLive = BunHttpServer.layer({ port: 3000 });
const FSLive = BunFileSystem.layer;
const PathLive = BunPath.layer;
const ClientLive = FetchHttpClient.layer;

const AppLive = Layer.mergeAll(HttpLive, FSLive, PathLive, ClientLive);

const server = router.pipe(HttpServer.serve, Layer.provide(AppLive), Layer.launch);

Effect.runPromise(server as Effect.Effect<never, never, never>);
