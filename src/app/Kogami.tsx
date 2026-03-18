import './styles.css';

import { FileText, LayoutDashboard, Settings } from 'lucide-react';
import { useState } from 'react';

import { ExchangeRatesView } from '../components/ExchangeRatesView';

const NAV_LIST = [
  { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
  { id: 'exchange-rates', name: 'Exchange Rates', icon: FileText },
  { id: 'settings', name: 'Settings', icon: Settings },
] as const;

export const KogamiApp = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'exchange-rates' | 'settings'>('exchange-rates');

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-slate-900 text-white flex flex-col fixed inset-y-0 left-0 z-50">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-500/20">K</div>
            <span className="text-xl font-bold tracking-tight">Kogami</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {NAV_LIST.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                activeTab === item.id ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="font-medium text-sm uppercase tracking-wide">{item.name}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 mt-auto border-t border-slate-800">
          <div className="flex items-center space-x-3 px-4 py-2">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xs uppercase">U</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">Admin</p>
              <p className="text-xs text-slate-500 truncate">admin@kogami.io</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="ml-64 flex-1 flex flex-col">
        <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-40 shadow-sm shadow-slate-200/50">
          <h1 className="text-2xl font-bold text-slate-800 capitalize tracking-tight">{activeTab.replace('-', ' ')} Portal</h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-slate-500 font-medium">
              System Status: <span className="text-emerald-500 font-bold">Online</span>
            </span>
          </div>
        </header>

        <div className="p-8 max-w-6xl mx-auto w-full">
          {activeTab === 'exchange-rates' ? (
            <ExchangeRatesView />
          ) : (
            <div className="h-64 flex items-center justify-center bg-white rounded-xl border-2 border-dashed border-slate-200 text-slate-400">
              <p className="text-lg font-medium tracking-tight">This section is under construction</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
