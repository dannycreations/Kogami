import { Data, Effect, FileSystem, Path } from 'effect';

export class StoreSerializationError extends Data.TaggedError('StoreSerializationError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export interface DataWithRange {
  readonly startDate: string;
  readonly endDate: string;
}

export type Store<T extends DataWithRange> = Record<string, T>;

export const makeStoreManager = <T extends DataWithRange>(filePath: string) => {
  let cache: Store<T> | null = null;

  const getStore = Effect.gen(function* () {
    if (cache) return cache;
    const fs = yield* FileSystem.FileSystem;
    if (!(yield* fs.exists(filePath))) return (cache = {} as Store<T>);

    // A missing or malformed store is treated as empty, which the scraper repopulates on demand.
    cache = yield* fs.readFileString(filePath).pipe(
      Effect.map((content) => JSON.parse(content) as Store<T>),
      Effect.orElseSucceed(() => ({}) as Store<T>),
    );
    return cache;
  });

  const saveStore = (store: Store<T>) =>
    Effect.gen(function* () {
      cache = store;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;

      const dir = path.dirname(filePath);
      if (!(yield* fs.exists(dir))) {
        yield* fs.makeDirectory(dir, { recursive: true });
      }

      // Sort keys to maintain predictable file structure and improve git diffs
      const sortedStore = Object.fromEntries(Object.entries(store).sort(([a], [b]) => b.localeCompare(a)));

      const content = yield* Effect.try({
        try: () => JSON.stringify(sortedStore),
        catch: (e) => new StoreSerializationError({ message: `JSON serialization failed: ${e}`, cause: e }),
      });

      yield* fs.writeFileString(filePath, content);
    });

  return { getStore, saveStore };
};
