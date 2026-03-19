import { HttpRouter, HttpServerRequest, HttpServerResponse } from '@effect/platform';
import { Effect } from 'effect';

import { getOrScrape, normalizeDate } from './Handler';

export const exchangeRatesRouter = HttpRouter.empty.pipe(
  HttpRouter.get(
    '/exchange-rates',
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      const url = new URL(request.url, 'http://localhost');
      const date = normalizeDate(url.searchParams.get('date'));

      if (!date) {
        return yield* HttpServerResponse.json({ error: 'Invalid or missing date parameter (YYYY-MM-DD or Tue, Mar 18, 2025)' }, { status: 400 });
      }

      const data = yield* getOrScrape(date);
      return yield* HttpServerResponse.json(data);
    }),
  ),
);
