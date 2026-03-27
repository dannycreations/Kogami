import './styles.css';

import { BookMarked, Calculator, Clock, DownloadCloud, FileSpreadsheet, FileText, Fingerprint, LayoutDashboard, Settings } from 'lucide-react';
import { useState } from 'react';

import { ExchangeRatesView } from '../components/ExchangeRatesView';

const NAV_LIST = [
  { id: 'dashboard', name: 'Overview', icon: LayoutDashboard },
  { id: 'transactions', name: 'Transactions', icon: FileSpreadsheet },
  { id: 'exchange-rates', name: 'Exchange Rates', icon: Calculator },
  { id: 'reports', name: 'Tax Reports', icon: FileText },
  { id: 'export', name: 'Data Export', icon: DownloadCloud },
  { id: 'audit', name: 'Audit Log', icon: Clock },
] as const;

export const KogamiApp = () => {
  const [activeTab, setActiveTab] = useState<(typeof NAV_LIST)[number]['id']>('exchange-rates');

  return (
    <div className="min-h-screen bg-[#fafafa] flex text-surface-900 font-sans">
      <aside className="w-56 bg-[#f6f7fb] border-r border-surface-200 flex flex-col fixed inset-y-0 left-0 z-50">
        <div className="p-5 border-b border-surface-200">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 bg-brand-800 rounded flex items-center justify-center shadow-sm">
              <Fingerprint className="h-5 w-5 text-white" strokeWidth={1.5} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight text-surface-900 leading-tight">Kogami</span>
              <span className="text-[10px] uppercase tracking-wider text-surface-500 font-semibold">Workspace</span>
            </div>
          </div>
        </div>

        <div className="flex-1 py-4 overflow-y-auto">
          <div className="px-3 mb-2">
            <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-surface-400 mb-2">Tools</p>
            <nav className="space-y-0.5">
              {NAV_LIST.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center space-x-2.5 px-2 py-1.5 rounded transition-all text-sm group ${
                    activeTab === item.id
                      ? 'bg-brand-100 text-brand-900 font-medium shadow-sm'
                      : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'
                  }`}
                >
                  <item.icon
                    className={`h-4 w-4 ${activeTab === item.id ? 'text-brand-700' : 'text-surface-400 group-hover:text-surface-600'}`}
                    strokeWidth={activeTab === item.id ? 2 : 1.5}
                  />
                  <span>{item.name}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="px-3 mt-6">
            <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-surface-400 mb-2">System</p>
            <nav className="space-y-0.5">
              <button className="w-full flex items-center space-x-2.5 px-2 py-1.5 rounded transition-all text-sm text-surface-600 hover:bg-surface-100 hover:text-surface-900 group">
                <BookMarked className="h-4 w-4 text-surface-400 group-hover:text-surface-600" strokeWidth={1.5} />
                <span>Documentation</span>
              </button>
              <button className="w-full flex items-center space-x-2.5 px-2 py-1.5 rounded transition-all text-sm text-surface-600 hover:bg-surface-100 hover:text-surface-900 group">
                <Settings className="h-4 w-4 text-surface-400 group-hover:text-surface-600" strokeWidth={1.5} />
                <span>Settings</span>
              </button>
            </nav>
          </div>
        </div>
      </aside>

      <main className="ml-56 flex-1 flex flex-col min-h-screen relative">
        <header className="h-14 bg-white/80 backdrop-blur-md border-b border-surface-200 px-6 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center">
            <h1 className="text-base font-semibold text-surface-800 capitalize">{activeTab.replace('-', ' ')}</h1>
          </div>
        </header>

        <div className="flex-1 p-6 w-full">
          {activeTab === 'exchange-rates' ? (
            <ExchangeRatesView />
          ) : (
            <div className="h-64 flex flex-col items-center justify-center bg-white rounded border border-dashed border-surface-300 text-surface-500">
              <FileSpreadsheet className="h-8 w-8 text-surface-300 mb-3" strokeWidth={1} />
              <p className="text-sm font-medium">Module not configured</p>
              <p className="text-xs text-surface-400 mt-1">Select Exchange Rates to proceed with tax calculation.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
