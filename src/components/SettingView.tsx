import { Globe } from 'lucide-react';

import { CURRENCIES } from '../app/constants';
import { useSettingStore } from '../stores/settingsStore';

export const SettingView = () => {
  const preferredCurrency = useSettingStore((state) => state.preferredCurrency);
  const setPreferredCurrency = useSettingStore((state) => state.setPreferredCurrency);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-lg border border-surface-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-surface-100 bg-surface-50/50">
          <div className="flex items-center space-x-2">
            <Globe className="h-4 w-4 text-brand-600" />
            <h2 className="text-xs font-bold text-surface-900 uppercase tracking-wider">Regional Settings</h2>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex flex-col space-y-2">
            <label className="text-sm font-bold text-surface-800">Preferred Currency</label>
            <p className="text-xs text-surface-500 mb-2">Select the currency used for all calculations and reports.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {CURRENCIES.map((currency) => (
                <button
                  key={currency.code}
                  type="button"
                  onClick={() => setPreferredCurrency(currency.code)}
                  className={`flex items-center justify-between p-3 rounded border transition-all ${
                    preferredCurrency === currency.code
                      ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-500'
                      : 'border-surface-200 hover:border-surface-300 bg-white'
                  }`}
                >
                  <div className="flex flex-col items-start">
                    <span className={`text-xs font-bold ${preferredCurrency === currency.code ? 'text-brand-900' : 'text-surface-900'}`}>
                      {currency.code}
                    </span>
                    <span className="text-[10px] text-surface-500">{currency.name}</span>
                  </div>
                  {preferredCurrency === currency.code && (
                    <div className="h-4 w-4 bg-brand-600 rounded-full flex items-center justify-center">
                      <div className="h-1.5 w-1.5 bg-white rounded-full" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface-100/50 p-4 rounded border border-dashed border-surface-300">
        <p className="text-[11px] text-surface-500 leading-relaxed italic">
          Note: Changing the preferred currency will update all dashboards and reports. Transactions kept in their original currency will be converted
          using historical exchange rates when possible, or the current rate if historical data is unavailable.
        </p>
      </div>
    </div>
  );
};
