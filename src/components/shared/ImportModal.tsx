import { Upload, X } from 'lucide-react';
import { useState } from 'react';

interface ImportModalProps<T> {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onImport: (data: T[]) => void;
  readonly title: string;
  readonly template: string;
  readonly example: string;
  readonly parseLine: (parts: string[], index: number) => T;
  readonly minColumns: number;
}

export const ImportCSVModal = <T extends { id: string }>({
  isOpen,
  onClose,
  onImport,
  title,
  template,
  example,
  parseLine,
  minColumns,
}: ImportModalProps<T>) => {
  const [csvData, setCsvData] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleImport = () => {
    try {
      setError(null);
      const lines = csvData
        .trim()
        .split('\n')
        .filter((line) => line.trim() !== '');

      if (lines.length === 0) {
        throw new Error('CSV is empty');
      }

      const firstLine = lines[0]!.toLowerCase();
      // Heuristic to skip header: if first line contains any template keywords
      const keywords = template.toLowerCase().split(',');
      const hasHeader = keywords.some((k) => firstLine.includes(k.trim()));
      const dataLines = hasHeader ? lines.slice(1) : lines;

      const newEntries: T[] = dataLines.map((line, index) => {
        const parts = line.split(',').map((p) => p.trim());

        if (parts.length < minColumns) {
          throw new Error(`Line ${index + (hasHeader ? 2 : 1)}: Invalid number of columns. Expected at least ${minColumns}.`);
        }

        return parseLine(parts, index + (hasHeader ? 2 : 1));
      });

      onImport(newEntries);
      setCsvData('');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error occurred');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv') && !file.type.includes('csv') && !file.type.includes('text/plain')) {
      setError('Please drop a CSV or text file.');
      return;
    }

    try {
      const text = await file.text();
      setCsvData(text);
      setError(null);
    } catch (err) {
      setError('Failed to read the file.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-surface-100">
          <div className="flex items-center space-x-2">
            <Upload className="h-5 w-5 text-brand-600" />
            <h2 className="text-sm font-bold text-surface-900 uppercase tracking-wider">{title}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-surface-50 rounded-full transition-colors">
            <X className="h-5 w-5 text-surface-400" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-auto">
          <p className="text-xs text-surface-500 mb-4 leading-relaxed">
            Paste your CSV data below. Format: <code className="bg-surface-100 px-1 rounded text-brand-700">{template}</code>
            <br />
            Example: <code className="bg-surface-100 px-1 rounded text-surface-600">{example}</code>
          </p>

          <textarea
            value={csvData}
            onChange={(e) => setCsvData(e.target.value)}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            placeholder={example}
            className={`w-full h-64 p-4 text-xs font-mono border rounded focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none resize-none transition-all ${
              isDragging ? 'bg-brand-50 border-brand-500 ring-2 ring-brand-500 ring-inset' : 'bg-surface-50 border-surface-200'
            }`}
          />

          {error && <div className="mt-3 p-3 bg-red-50 border border-red-100 text-red-600 text-[11px] font-medium rounded">{error}</div>}
        </div>

        <div className="p-4 border-t border-surface-100 flex justify-end space-x-3 bg-surface-50/50 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-surface-600 hover:text-surface-900 transition-colors uppercase tracking-wider"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            className="px-6 py-2 bg-brand-800 text-white rounded text-xs font-bold hover:bg-brand-900 transition-colors shadow-sm uppercase tracking-wider"
          >
            Import Data
          </button>
        </div>
      </div>
    </div>
  );
};
