import { BunFileSystem, BunPath } from '@effect/platform-bun';
import { describe, expect, test } from 'bun:test';
import { Effect, Layer } from 'effect';
import { FetchHttpClient } from 'effect/http';

import { fillGaps, ScraperError } from '@kogami/server/helpers/Scraper';

import type { Store } from '@kogami/server/structures/StoreManager';
import type { BaseRateData, BaseRateEntry } from '@kogami/server/types/rates';

interface Entry extends BaseRateEntry {
  readonly name: string;
}

type Data = BaseRateData<Entry>;

type TestScraper = {
  readonly getStore: Effect.Effect<Store<Data>>;
  readonly getOrScrape: (date: string) => Effect.Effect<Data, ScraperError>;
  readonly since: string;
};

const TODAY = '2026-09-16';
const WINDOW_DAYS = 40;
const NO_DELAY = '0 millis';

const MS_PER_DAY = 86_400_000;

const addDays = (date: string, days: number) => new Date(new Date(date).getTime() + days * MS_PER_DAY).toISOString().slice(0, 10);
const dayDiff = (from: string, to: string) => Math.round((new Date(to).getTime() - new Date(from).getTime()) / MS_PER_DAY);

// Every week in this file is aligned to the window start so consecutive weeks chain.
const FIRST_MONDAY = (() => {
  const start = addDays(TODAY, -WINDOW_DAYS);
  return addDays(start, -((new Date(start).getUTCDay() + 6) % 7));
})();

const weekAt = (date: string): Data => {
  const startDate = addDays(FIRST_MONDAY, Math.floor(dayDiff(FIRST_MONDAY, date) / 7) * 7);
  return { startDate, endDate: addDays(startDate, 6), entries: [{ name: 'row', rate: 1 }] };
};

const weeksCoveringWindow = (): Data[] =>
  Array.from({ length: Math.ceil((dayDiff(FIRST_MONDAY, TODAY) + 1) / 7) }, (_, i) => weekAt(addDays(FIRST_MONDAY, i * 7)));

const toStore = (list: Data[]) => Object.fromEntries(list.map((d) => [`${d.startDate}_${d.endDate}`, d]));

const keyOf = (data: Data) => `${data.startDate}_${data.endDate}`;

const setup = (
  initial: Record<string, Data>,
  scrape: (date: string, store: Record<string, Data>) => Effect.Effect<Data, ScraperError>,
  since: string = FIRST_MONDAY,
) => {
  const state: { store: Record<string, Data> } = { store: initial };
  const requested: string[] = [];

  const scraper: TestScraper = {
    getStore: Effect.sync(() => state.store),
    getOrScrape: (date) => {
      requested.push(date);
      return scrape(date, state.store);
    },
    since,
  };

  return { scraper, requested, store: () => state.store };
};

// The fake scraper reads nothing from these services, but fillGaps declares them as
// requirements, so they have to be in context to run it.
const UnusedServices = Layer.mergeAll(BunPath.layer, BunFileSystem.layer, FetchHttpClient.layer);

const run = (scraper: TestScraper) =>
  Effect.runPromise(fillGaps<Entry>('test', scraper, TODAY, WINDOW_DAYS, NO_DELAY).pipe(Effect.provide(UnusedServices)));

const fillFromSource = (date: string, store: Record<string, Data>) => {
  const data = weekAt(date);
  store[keyOf(data)] = data;
  return Effect.succeed(data);
};

describe('fillGaps', () => {
  test('backfills the whole source history when the store is empty', async () => {
    const { scraper, requested, store } = setup({}, fillFromSource);

    expect(await run(scraper)).toBe(0);
    expect(requested[0]).toBe(FIRST_MONDAY);
    expect(Object.keys(store()).sort()).toEqual(weeksCoveringWindow().map(keyOf).sort());
  });

  test('skips archive gaps older than the repair window instead of reporting them', async () => {
    const windowStart = addDays(TODAY, -WINDOW_DAYS);
    const { scraper, requested } = setup({}, (date, current) =>
      date < windowStart ? Effect.fail(new ScraperError({ message: 'nothing published', unavailable: true })) : fillFromSource(date, current),
    );

    expect(await run(scraper)).toBe(0);
    expect(requested[0]).toBe(FIRST_MONDAY);
  });

  test('does nothing when the window is already covered', async () => {
    const { scraper, requested } = setup(toStore(weeksCoveringWindow()), (date, store) => fillFromSource(date, store));

    expect(await run(scraper)).toBe(0);
    expect(requested).toEqual([]);
  });

  test('repairs a hole that sits behind the newest stored range', async () => {
    const weeks = weeksCoveringWindow();
    const hole = weeks[2]!;
    const withoutHole = weeks.filter((w) => w !== hole);
    const { scraper, requested, store } = setup(toStore(withoutHole), (date, current) => fillFromSource(date, current));

    expect(await run(scraper)).toBe(0);
    expect(requested).toEqual([hole.startDate]);
    expect(store()[keyOf(hole)]).toBeDefined();
  });

  test('keeps filling after a failed date instead of abandoning the window', async () => {
    const weeks = weeksCoveringWindow();
    const failing = weeks.at(-1)!;
    const { scraper, requested, store } = setup(toStore(weeks.slice(0, -1)), (date, current) =>
      date === failing.startDate ? Effect.fail(new ScraperError({ message: 'not published yet' })) : fillFromSource(date, current),
    );

    expect(await run(scraper)).toBe(1);
    // The run steps over the failed date and still fills the rest of its week.
    expect(requested).toEqual([failing.startDate, addDays(failing.startDate, 1)]);
    expect(store()[keyOf(failing)]).toBeDefined();
  });

  test('reports a date as unfilled when a fetch succeeds without covering it', async () => {
    const weeks = weeksCoveringWindow();
    const stale = weeks[0]!;
    const store = toStore(weeks.slice(1));
    const { scraper, requested } = setup(store, () => Effect.succeed(stale));

    // Every fetch returns a range that does not cover the requested date, so the
    // run must report the gaps rather than claim success.
    expect(await run(scraper)).toBeGreaterThan(0);
    expect(requested.length).toBeGreaterThan(0);
  });
});
