import type { CurrencyCode } from '@kogami/client/app/constants';
import type { InvestmentTransaction } from '@kogami/client/stores/investmentStore';
import type { Transaction } from '@kogami/client/stores/transactionStore';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const requireDate = (date: string | undefined, line: number): string => {
  if (!date || !ISO_DATE.test(date)) {
    throw new Error(`Line ${line}: Invalid date format. Expected YYYY-MM-DD.`);
  }
  return date;
};

const parseNumber = (raw: string | undefined): number => parseFloat(raw || '0');

const toCurrency = (raw: string | undefined): CurrencyCode => (raw?.toUpperCase() as CurrencyCode) || 'USD';

export const parseTransactionLine = (parts: string[], line: number): Transaction => {
  const [rawDate, ...columns] = parts;
  const date = requireDate(rawDate, line);

  const hasActionColumn = columns.length >= 5;
  const [action, description, category, currency, rawAmount] = hasActionColumn ? columns : ['', ...columns];

  const amount = parseNumber(rawAmount);
  if (isNaN(amount)) {
    throw new Error(`Line ${line}: Amount must be a number.`);
  }

  const isOutgoing = hasActionColumn ? action?.toUpperCase() === 'OUT' : amount < 0;

  return {
    id: crypto.randomUUID(),
    date,
    action: isOutgoing ? 'OUT' : 'IN',
    description: description || '',
    category: category || '',
    currency: toCurrency(currency),
    amount: Math.abs(amount),
  };
};

export const parseInvestmentLine = (parts: string[], line: number): InvestmentTransaction => {
  const [rawDate, rawAction, symbol, rawQuantity, currency, rawPrice] = parts;

  const date = requireDate(rawDate, line);

  const action = rawAction?.toUpperCase();
  if (action !== 'BUY' && action !== 'SELL') {
    throw new Error(`Line ${line}: Action must be 'buy' or 'sell'.`);
  }

  const quantity = parseNumber(rawQuantity);
  const price = parseNumber(rawPrice);
  if (isNaN(quantity) || isNaN(price)) {
    throw new Error(`Line ${line}: Quantity and Price must be numbers.`);
  }

  return {
    id: crypto.randomUUID(),
    date,
    action,
    symbol: symbol?.toUpperCase() || '',
    quantity: Math.abs(quantity),
    currency: toCurrency(currency),
    price: Math.abs(price),
  };
};

export const downloadCSV = (fileName: string, rows: readonly (readonly (string | number)[])[]) => {
  const blob = new Blob([rows.map((row) => row.join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
