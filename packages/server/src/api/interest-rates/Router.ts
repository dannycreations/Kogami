import { HttpRouter } from 'effect/http';

import { handleRateRequest } from '@kogami/server/api/handleRateRequest';
import { scraper } from '@kogami/server/api/interest-rates/Handler';

export const interestRatesRoutes = HttpRouter.addAll([HttpRouter.route('GET', '/interest-rates', handleRateRequest(scraper.getOrScrape))]);
