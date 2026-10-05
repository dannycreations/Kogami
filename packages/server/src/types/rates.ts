export interface BaseRateEntry {
  readonly rate: number;
}

export interface ExchangeRateEntry extends BaseRateEntry {
  readonly currency: string;
}

export interface InterestRateEntry extends BaseRateEntry {
  readonly tags: string;
}

export interface BaseRateData<T extends BaseRateEntry> {
  readonly startDate: string;
  readonly endDate: string;
  readonly entries: T[];
}

export type ExchangeRateData = BaseRateData<ExchangeRateEntry>;

export type InterestRateData = BaseRateData<InterestRateEntry>;
