import { HttpRouter, HttpServerRequest, HttpServerResponse } from '@effect/platform';
import { Effect } from 'effect';

import { getOrScrape } from './Handler';

const months: Record<string, string> = {
  Jan: '01',
  Feb: '02',
  Mar: '03',
  Apr: '04',
  May: '05',
  Jun: '06',
  Jul: '07',
  Aug: '08',
  Sep: '09',
  Oct: '10',
  Nov: '11',
  Dec: '12',
};

export const exchangeRatesRouter = HttpRouter.empty.pipe(
  HttpRouter.get(
    '/exchange-rates',
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      const url = new URL(request.url, 'http://localhost');
      let date = url.searchParams.get('date');

      if (date && /^\w{3},\s+\w{3}\s+\d{1,2},\s+\d{4}$/.test(date)) {
        const match = date.match(/^\w{3},\s+(\w{3})\s+(\d{1,2}),\s+(\d{4})$/);
        if (match && months[match[1]]) {
          const [, month, day, year] = match;
          date = `${year}-${months[month]}-${day.padStart(2, '0')}`;
        }
      }

      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return yield* HttpServerResponse.json({ error: 'Invalid or missing date parameter (YYYY-MM-DD or Tue, Mar 18, 2025)' }, { status: 400 });
      }

      const data = yield* getOrScrape(date);
      return yield* HttpServerResponse.json(data);
    }),
  ),
);
