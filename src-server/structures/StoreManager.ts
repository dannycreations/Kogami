import { FileSystem, Path } from '@effect/platform';
import { Effect } from 'effect';

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

    cache = yield* fs.readFileString(filePath).pipe(
      Effect.flatMap((content) =>
        Effect.try({
          try: () => JSON.parse(content) as Store<T>,
          catch: () => ({}) as Store<T>,
        }),
      ),
      Effect.catchAll(() => Effect.succeed({} as Store<T>)),
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

      // @effect-diagnostics-next-line globalErrorInEffectCatch:off
      const content = yield* Effect.try({
        try: () => JSON.stringify(sortedStore),
        // @effect-diagnostics-next-line globalErrorInEffectFailure:off
        catch: (e) => new Error(`JSON serialization failed: ${e}`),
      });

      yield* fs.writeFileString(filePath, content);
    });

  return { getStore, saveStore };
};
