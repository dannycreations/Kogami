import { HttpRouter, HttpServerRequest, HttpServerResponse } from '@effect/platform';
import { normalizeDate } from '@server/utilities/Date';
import { Effect } from 'effect';

import { scraper } from './Handler';

export const interestRatesRouter = HttpRouter.empty.pipe(
  HttpRouter.get(
    '/interest-rates',
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      const url = new URL(request.url, 'http://localhost');
      const date = normalizeDate(url.searchParams.get('date'));

      if (!date) {
        return yield* HttpServerResponse.json({ error: 'Invalid or missing date parameter' }, { status: 400 });
      }

      const data = yield* scraper.getOrScrape(date);
      return yield* HttpServerResponse.json(data);
    }),
  ),
);
