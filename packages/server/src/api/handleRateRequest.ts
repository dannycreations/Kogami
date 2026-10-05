import { Effect } from 'effect';
import { HttpServerRequest, HttpServerResponse } from 'effect/http';

import { normalizeDate } from '@kogami/server/utilities/date';

export const handleRateRequest = <A, E, R>(getOrScrape: (date: string) => Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const url = new URL(request.url, 'http://localhost');
    const date = normalizeDate(url.searchParams.get('date'));

    if (!date) {
      return yield* HttpServerResponse.json({ error: 'Invalid or missing date parameter' }, { status: 400 });
    }

    return yield* HttpServerResponse.json(yield* getOrScrape(date));
  });
