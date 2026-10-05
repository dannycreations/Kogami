import { makeScraper } from '@kogami/server/helpers/Scraper';

import type { InterestRateEntry } from '@kogami/server/types/rates';

export const scraper = makeScraper<InterestRateEntry>('interest', (dom) => {
  const rows = dom.querySelectorAll('table tbody tr');
  return Array.from(rows, (item) => {
    const row = item as Element;
    const tags = row.querySelector('td.text-left')?.textContent?.trim() || '';
    const rateText = row.querySelector('td:last-child')?.textContent?.trim() || '0';
    const rateMatch = rateText.match(/([\d,]+)%/);
    const rate = rateMatch ? parseFloat(rateMatch[1]!.replace(',', '.')) : 0;
    return { tags, rate };
  });
});
