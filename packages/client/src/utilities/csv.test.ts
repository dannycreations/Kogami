import { describe, expect, test } from 'bun:test';

import { parseInvestmentLine, parseTransactionLine } from '@kogami/client/utilities/csv';

describe('parseTransactionLine', () => {
  test('maps the six-column export format in order', () => {
    expect(parseTransactionLine(['2024-01-01', 'OUT', 'Lunch', 'Food', 'usd', '15.50'], 2)).toEqual({
      id: expect.any(String),
      date: '2024-01-01',
      action: 'OUT',
      description: 'Lunch',
      category: 'Food',
      currency: 'USD',
      amount: 15.5,
    });
  });

  test('defaults the action to IN when the column holds something else', () => {
    expect(parseTransactionLine(['2024-01-01', 'in', 'Lunch', 'Food', 'USD', '15.50'], 1).action).toBe('IN');
  });

  test('reads the action from the sign of a legacy five-column amount', () => {
    expect(parseTransactionLine(['2024-01-01', 'Lunch', 'Food', 'USD', '-20'], 1)).toMatchObject({
      action: 'OUT',
      description: 'Lunch',
      category: 'Food',
      currency: 'USD',
      amount: 20,
    });
  });

  test('rejects a malformed date and reports the source line', () => {
    expect(() => parseTransactionLine(['01-01-2024', 'IN', 'Lunch', 'Food', 'USD', '1'], 3)).toThrow(
      'Line 3: Invalid date format. Expected YYYY-MM-DD.',
    );
  });

  test('rejects a non-numeric amount', () => {
    expect(() => parseTransactionLine(['2024-01-01', 'IN', 'Lunch', 'Food', 'USD', 'abc'], 4)).toThrow('Line 4: Amount must be a number.');
  });
});

describe('parseInvestmentLine', () => {
  test('normalises action, symbol and currency', () => {
    expect(parseInvestmentLine(['2024-01-01', 'buy', 'aapl', '10', 'usd', '150.00'], 1)).toEqual({
      id: expect.any(String),
      date: '2024-01-01',
      action: 'BUY',
      symbol: 'AAPL',
      quantity: 10,
      currency: 'USD',
      price: 150,
    });
  });

  test('rejects an unknown action and reports the source line', () => {
    expect(() => parseInvestmentLine(['2024-01-01', 'hold', 'AAPL', '10', 'USD', '150.00'], 4)).toThrow("Line 4: Action must be 'buy' or 'sell'.");
  });

  test('rejects a non-numeric quantity or price', () => {
    expect(() => parseInvestmentLine(['2024-01-01', 'buy', 'AAPL', 'lots', 'USD', '150.00'], 1)).toThrow(
      'Line 1: Quantity and Price must be numbers.',
    );
  });
});
