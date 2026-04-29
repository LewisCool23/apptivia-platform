import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, Database, FileText, AlertCircle, CheckCircle, X, AlertTriangle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { backendFetch } from '../utils/backendFetch';

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { result.push(current); current = ''; }
      else { current += ch; }
    }
  }
  result.push(current);
  return result.map(v => v.trim());
}

export default function KpiImportModal({ isOpen, onClose, onImportComplete, organizationId }) {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const [validationWarnings, setValidationWarnings] = useState([]);
  const [importResults, setImportResults] = useState(null);
  const [error, setError] = useState('');
  const [activeKpis, setActiveKpis] = useState([]);
  const fileInputRef = useRef(null);

  // Fetch org's active KPIs for template generation
  useEffect(() => {
    if (!isOpen || !organizationId) return;
    supabase
      .from('kpi_org_configs')
      .select('kpi_id, show_on_scorecard, kpi_metrics!inner(key, name, unit)')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .then(({ data }) => {
        const kpis = (data || []).map(c => ({
          key: c.kpi_metrics.key,
          name: c.kpi_metrics.name,
          unit: c.kpi_metrics.unit,
        }));
        // Put scorecard KPIs first
        const scorecard = (data || []).filter(c => c.show_on_scorecard);
        const scorecardKeys = new Set(scorecard.map(c => c.kpi_metrics.key));
        kpis.sort((a, b) => {
          const aS = scorecardKeys.has(a.key) ? 0 : 1;
          const bS = scorecardKeys.has(b.key) ? 0 : 1;
          return aS - bS || a.name.localeCompare(b.name);
        });
        setActiveKpis(kpis);
      });
  }, [isOpen, organizationId]);

  const downloadTemplate = () => {
    const kpiKeys = activeKpis.map(k => k.key);
    const header = ['week_start', 'rep_email', ...kpiKeys].join(',');
    const commentRow = ['# ' + activeKpis.map(k => `${k.key}=${k.name} (${k.unit})`).join(', ')];
    const exampleRow = ['2026-01-06', 'rep@company.com', ...kpiKeys.map(() => '')].join(',');
    const csv = `${header}\n${exampleRow}`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kpi-import-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        setError('Please upload a CSV file');
        return;
      }
      if (selectedFile.size > 5 * 1024 * 1024) {
        setError('File too large. Maximum 5MB.');
        return;
      }
      setFile(selectedFile);
      parseFile(selectedFile);
    }
  };

  const parseFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('#'));
        if (lines.length < 2) {
          setError('CSV must have a header row and at least one data row');
          return;
        }
        const hdrs = parseCSVLine(lines[0]);
        setHeaders(hdrs);

        const data = lines.slice(1).map((line, i) => {
          const values = parseCSVLine(line);
          const row = {};
          hdrs.forEach((h, j) => { row[h] = values[j] || ''; });
          row._rowNumber = i + 2;
          return row;
        });

        if (data.length > 10000) {
          setError('Maximum 10,000 rows per import. Please split into smaller files.');
          return;
        }

        setParsedData(data);
        runValidation(data, hdrs);
        setStep(2);
        setError('');
      } catch (err) {
        setError('Failed to parse CSV file. Please check the format.');
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  const runValidation = (data, hdrs) => {
    const errors = [];
    const warnings = [];
    const kpiKeySet = new Set(activeKpis.map(k => k.key));
    const csvKpiCols = hdrs.filter(h => h !== 'week_start' && h !== 'rep_email');

    if (!hdrs.includes('week_start')) {
      errors.push({ type: 'header', message: 'Missing required column: week_start' });
    }
    if (!hdrs.includes('rep_email')) {
      errors.push({ type: 'header', message: 'Missing required column: rep_email' });
    }
    csvKpiCols.forEach(col => {
      if (!kpiKeySet.has(col)) {
        warnings.push({ type: 'column', message: `Column "${col}" is not a recognized KPI key — will be ignored` });
      }
    });
    const recognizedKpiCols = csvKpiCols.filter(c => kpiKeySet.has(c));
    if (recognizedKpiCols.length === 0 && errors.length === 0) {
      errors.push({ type: 'header', message: 'No recognized KPI columns found. Use KPI keys like call_connects, talk_time_minutes, etc.' });
    }

    const seenRepWeeks = new Set();
    data.forEach((row) => {
      if (!row.week_start || !/^\d{4}-\d{2}-\d{2}$/.test(row.week_start)) {
        errors.push({ row: row._rowNumber, field: 'week_start', message: 'Invalid date format (expected YYYY-MM-DD)' });
      } else {
        const d = new Date(row.week_start + 'T00:00:00Z');
        if (isNaN(d.getTime())) {
          errors.push({ row: row._rowNumber, field: 'week_start', message: `${row.week_start} is not a valid date` });
        } else if (d.getUTCDay() !== 1) {
          errors.push({ row: row._rowNumber, field: 'week_start', message: `${row.week_start} is not a Monday` });
        }
      }
      if (!row.rep_email || !row.rep_email.includes('@')) {
        errors.push({ row: row._rowNumber, field: 'rep_email', message: 'Invalid or missing email' });
      }
      // Detect duplicate rep+week combos within the same CSV
      if (row.rep_email && row.week_start) {
        const dupeKey = `${row.rep_email.trim().toLowerCase()}:${row.week_start}`;
        if (seenRepWeeks.has(dupeKey)) {
          warnings.push({ row: row._rowNumber, message: `Duplicate entry for ${row.rep_email} in week ${row.week_start} — values will be added separately` });
        }
        seenRepWeeks.add(dupeKey);
      }
      recognizedKpiCols.forEach(col => {
        const val = row[col];
        if (val !== '' && val !== undefined && isNaN(parseFloat(val))) {
          errors.push({ row: row._rowNumber, field: col, message: `"${val}" is not a number` });
        }
      });
    });

    setValidationErrors(errors);
    setValidationWarnings(warnings);
  };

  const hasBlockingErrors = validationErrors.some(e => e.type === 'header') || validationErrors.length > parsedData.length * 0.5;
  const errorRows = new Set(validationErrors.filter(e => e.row).map(e => e.row));

  const handleImport = async () => {
    setStep(3);
    setError('');
    try {
      const data = await backendFetch('/api/kpi/import', {
        rows: parsedData.map(({ _rowNumber, ...rest }) => rest),
        filename: file?.name || 'import.csv',
      });
      setImportResults(data);
      setStep(4);
      if (onImportComplete) onImportComplete();
    } catch (err) {
      setError(err.message || 'Import failed');
      setStep(2);
    }
  };

  const handleClose = () => {
    setStep(1);
    setFile(null);
    setParsedData([]);
    setHeaders([]);
    setValidationErrors([]);
    setValidationWarnings([]);
    setImportResults(null);
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  const uniqueWeeks = new Set(parsedData.map(r => r.week_start).filter(Boolean));
  const uniqueEmails = new Set(parsedData.map(r => r.rep_email).filter(Boolean));
  const kpiKeySet = new Set(activeKpis.map(k => k.key));
  const kpiColHeaders = headers.filter(h => h !== 'week_start' && h !== 'rep_email' && kpiKeySet.has(h));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Database size={24} className="text-emerald-600" />
            <div>
              <h2 className="text-xl font-bold">Import Historical KPI Data</h2>
              <p className="text-sm text-apptivia-carbon-500">
                {step === 1 && 'Upload a CSV file with historical performance data'}
                {step === 2 && `Review ${parsedData.length} rows across ${uniqueWeeks.size} weeks`}
                {step === 3 && 'Importing data...'}
                {step === 4 && 'Import complete!'}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-apptivia-carbon-100 rounded-lg transition-colors">
            <X size={20} className="text-apptivia-carbon-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
              <div className="whitespace-pre-line">{error}</div>
            </div>
          )}

          {/* Step 1: Upload */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-emerald-400 transition-colors">
                <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />
                <Upload size={48} className="mx-auto text-apptivia-carbon-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Upload CSV File</h3>
                <p className="text-sm text-apptivia-carbon-600 mb-4">
                  Upload historical KPI data to backfill scorecards. Max 5MB / 10,000 rows.
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  Choose File
                </button>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <FileText size={20} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-emerald-900 mb-1">CSV Format</div>
                    <ul className="text-sm text-emerald-800 space-y-1">
                      <li>• Required columns: <code className="bg-emerald-100 px-1 rounded">week_start</code> (Monday, YYYY-MM-DD), <code className="bg-emerald-100 px-1 rounded">rep_email</code></li>
                      <li>• KPI columns use metric keys: <code className="bg-emerald-100 px-1 rounded">call_connects</code>, <code className="bg-emerald-100 px-1 rounded">talk_time_minutes</code>, etc.</li>
                      <li>• One row per rep per week. Empty cells are skipped.</li>
                      <li>• Values are additive — won't overwrite existing data.</li>
                    </ul>
                    {activeKpis.length > 0 && (
                      <div className="mt-2 text-xs text-emerald-700">
                        Your org has {activeKpis.length} active KPIs. Download the template for the correct column headers.
                      </div>
                    )}
                    <button
                      onClick={downloadTemplate}
                      disabled={activeKpis.length === 0}
                      className="mt-3 flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium disabled:opacity-50"
                    >
                      <Download size={16} />
                      Download Template
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Review */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Summary bar */}
              <div className="flex items-center justify-between p-3 bg-apptivia-paper rounded-lg">
                <div>
                  <div className="font-semibold">{parsedData.length} rows — {uniqueEmails.size} reps, {uniqueWeeks.size} weeks, {kpiColHeaders.length} KPIs</div>
                  <div className="text-sm text-apptivia-carbon-600">Review the data below before importing</div>
                </div>
                <div className="flex gap-2">
                  {validationErrors.length > 0 && (
                    <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                      {validationErrors.length} error{validationErrors.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {validationWarnings.length > 0 && (
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                      {validationWarnings.length} warning{validationWarnings.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Warnings */}
              {validationWarnings.length > 0 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
                  <div className="flex items-center gap-2 text-yellow-800 font-medium mb-1">
                    <AlertTriangle size={14} /> Warnings
                  </div>
                  {validationWarnings.map((w, i) => (
                    <div key={i} className="text-yellow-700 text-xs ml-5">{w.message}</div>
                  ))}
                </div>
              )}

              {/* Row-level errors */}
              {validationErrors.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm max-h-32 overflow-y-auto">
                  <div className="flex items-center gap-2 text-red-800 font-medium mb-1">
                    <AlertCircle size={14} /> Errors
                  </div>
                  {validationErrors.slice(0, 20).map((e, i) => (
                    <div key={i} className="text-red-700 text-xs ml-5">
                      {e.row ? `Row ${e.row}` : 'Header'}: {e.message}
                    </div>
                  ))}
                  {validationErrors.length > 20 && (
                    <div className="text-red-600 text-xs ml-5 mt-1">...and {validationErrors.length - 20} more</div>
                  )}
                </div>
              )}

              {/* Preview table */}
              <div className="overflow-x-auto border rounded-lg max-h-[40vh]">
                <table className="w-full text-xs">
                  <thead className="bg-apptivia-paper border-b sticky top-0">
                    <tr>
                      <th className="px-2 py-2 text-left font-semibold">#</th>
                      <th className="px-2 py-2 text-left font-semibold">week_start</th>
                      <th className="px-2 py-2 text-left font-semibold">rep_email</th>
                      {kpiColHeaders.map(k => (
                        <th key={k} className="px-2 py-2 text-right font-semibold whitespace-nowrap">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.slice(0, 100).map((row, i) => (
                      <tr key={i} className={`border-b ${errorRows.has(row._rowNumber) ? 'bg-red-50' : 'hover:bg-apptivia-paper'}`}>
                        <td className="px-2 py-1.5 text-apptivia-carbon-400">{i + 1}</td>
                        <td className="px-2 py-1.5 font-mono">{row.week_start}</td>
                        <td className="px-2 py-1.5">{row.rep_email}</td>
                        {kpiColHeaders.map(k => (
                          <td key={k} className="px-2 py-1.5 text-right font-mono">
                            {row[k] || <span className="text-apptivia-carbon-300">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedData.length > 100 && (
                  <div className="text-center text-xs text-apptivia-carbon-400 py-2 bg-apptivia-paper border-t">
                    Showing first 100 of {parsedData.length} rows
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Importing */}
          {step === 3 && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-emerald-600 mx-auto mb-4"></div>
              <div className="text-lg font-semibold mb-2">Importing {parsedData.length} rows...</div>
              <div className="text-sm text-apptivia-carbon-600">This may take a moment for large files</div>
            </div>
          )}

          {/* Step 4: Results */}
          {step === 4 && importResults && (
            <div className="space-y-6">
              <div className="text-center py-6">
                <CheckCircle size={64} className="mx-auto text-emerald-600 mb-4" />
                <h3 className="text-2xl font-bold mb-1">Import Complete!</h3>
                {importResults.weekRange && (
                  <p className="text-sm text-apptivia-carbon-500">{importResults.weekRange} — {importResults.repCount} reps, {importResults.kpiCount} KPIs</p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-green-600">{importResults.imported}</div>
                  <div className="text-sm text-green-700">Values Imported</div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-yellow-600">{importResults.skipped}</div>
                  <div className="text-sm text-yellow-700">Skipped (duplicates)</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-red-600">{importResults.failed}</div>
                  <div className="text-sm text-red-700">Failed</div>
                </div>
              </div>

              {importResults.errors && importResults.errors.length > 0 && (
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-2 text-red-700">Error Details</h4>
                  <div className="space-y-1 text-sm max-h-40 overflow-y-auto">
                    {importResults.errors.map((err, i) => (
                      <div key={i} className="text-red-600 text-xs">
                        {err.row ? `Row ${err.row}` : ''} {err.field ? `[${err.field}]` : ''} {err.email ? `(${err.email})` : ''}: {err.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-apptivia-paper flex items-center justify-between">
          <button onClick={handleClose} className="px-4 py-2 text-apptivia-carbon-600 hover:text-apptivia-ink">
            {step === 4 ? 'Close' : 'Cancel'}
          </button>

          {step === 2 && (
            <button
              onClick={handleImport}
              disabled={hasBlockingErrors}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Import {parsedData.length} Rows
            </button>
          )}

          {step === 4 && (
            <button
              onClick={handleClose}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
