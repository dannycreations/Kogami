import { HttpRouter } from 'effect/http';

import { scraper } from '@kogami/server/api/exchange-rates/Handler';
import { handleRateRequest } from '@kogami/server/api/handleRateRequest';

export const exchangeRatesRoutes = HttpRouter.addAll([HttpRouter.route('GET', '/exchange-rates', handleRateRequest(scraper.getOrScrape))]);
