import { Effect } from 'effect';
import { HttpRouter, HttpServerRequest, HttpServerResponse } from 'effect/http';

import { scraper } from '@kogami/server/api/exchange-rates/Handler';
import { normalizeDate } from '@kogami/server/utilities/date';

export const interestRatesRoutes = HttpRouter.addAll([
  HttpRouter.route(
    'GET',
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
]);
