import { makeScraper } from '../../helpers/Scraper';

import type { ExchangeRateEntry } from '../../helpers/Scraper';

export const scraper = makeScraper<ExchangeRateEntry>('exchange', (dom) => {
  const rows = dom.querySelectorAll('table tbody tr');
  return Array.from(rows, (row: any) => {
    const full = row.querySelector('td:nth-child(2) .hidden-xs')?.textContent?.trim() || '';
    const currency = full.match(/\(([^)]+)\)/)?.[1] || full;
    const rateText = row.querySelector('td:nth-child(3) .m-l-5')?.textContent?.trim() || '0';
    const rate = parseFloat(rateText.replace(/\./g, '').replace(',', '.'));
    return { currency, rate };
  });
});
