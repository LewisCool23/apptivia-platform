import React, { useState, useRef } from 'react';
import { Upload, Download, Users, FileText, AlertCircle, CheckCircle, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../AuthContext';

export default function UserImportModal({ isOpen, onClose, onImportComplete }) {
  const { profile } = useAuth();
  const [step, setStep] = useState(1); // 1=upload, 2=review, 3=importing, 4=complete
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [importResults, setImportResults] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const downloadTemplate = () => {
    const template = `first_name,last_name,email,role,team,department,title
John,Doe,john.doe@company.com,power_user,Sales Team,Sales,Sales Representative
Jane,Smith,jane.smith@company.com,manager,Sales Team,Sales,Sales Manager
Mike,Johnson,mike.johnson@company.com,power_user,Marketing Team,Marketing,Marketing Specialist`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'user-import-template.csv';
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
      setFile(selectedFile);
      parseCSV(selectedFile);
    }
  };

  const parseCSV = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim());
        
        const data = lines.slice(1).map((line, index) => {
          const values = line.split(',').map(v => v.trim());
          const row = {};
          headers.forEach((header, i) => {
            row[header] = values[i] || '';
          });
          row._rowNumber = index + 2; // +2 because of header and 0-index
          return row;
        });

        setParsedData(data);
        setStep(2);
        setError('');
      } catch (err) {
        setError('Failed to parse CSV file. Please check the format.');
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  const validateData = () => {
    const errors = [];
    parsedData.forEach((row, index) => {
      if (!row.email) {
        errors.push(`Row ${row._rowNumber}: Email is required`);
      } else if (!row.email.includes('@')) {
        errors.push(`Row ${row._rowNumber}: Invalid email format`);
      }
      if (!row.first_name) {
        errors.push(`Row ${row._rowNumber}: First name is required`);
      }
      if (!row.last_name) {
        errors.push(`Row ${row._rowNumber}: Last name is required`);
      }
    });
    return errors;
  };

  const handleImport = async () => {
    const validationErrors = validateData();
    if (validationErrors.length > 0) {
      setError(`Validation errors:\n${validationErrors.join('\n')}`);
      return;
    }

    setStep(3);
    setError('');

    try {
      // Create import job
      const { data: job, error: jobError } = await supabase
        .from('user_import_jobs')
        .insert({
          organization_id: profile.organization_id,
          import_type: 'csv',
          status: 'processing',
          total_records: parsedData.length,
          created_by: profile.id,
        })
        .select()
        .single();

      if (jobError) throw jobError;

      let created = 0;
      let updated = 0;
      let failed = 0;
      const errorLog = [];

      // Process each user
      for (const row of parsedData) {
        try {
          // Check if user exists
          const { data: existing } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', row.email)
            .eq('organization_id', profile.organization_id)
            .single();

          const userData = {
            organization_id: profile.organization_id,
            email: row.email,
            first_name: row.first_name,
            last_name: row.last_name,
            role: row.role || 'power_user',
            department: row.department || null,
            title: row.title || null,
          };

          if (existing) {
            // Update existing user
            const { error: updateError } = await supabase
              .from('profiles')
              .update(userData)
              .eq('id', existing.id);

            if (updateError) throw updateError;
            updated++;
          } else {
            // Create new user (in production, you'd send an invitation email)
            const { error: insertError } = await supabase
              .from('profiles')
              .insert(userData);

            if (insertError) throw insertError;
            created++;
          }
        } catch (err) {
          failed++;
          errorLog.push({
            row: row._rowNumber,
            email: row.email,
            error: err.message,
          });
        }
      }

      // Update import job
      await supabase
        .from('user_import_jobs')
        .update({
          status: failed > 0 ? 'partial' : 'completed',
          processed_records: parsedData.length,
          created_records: created,
          updated_records: updated,
          failed_records: failed,
          error_log: errorLog.length > 0 ? errorLog : null,
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      setImportResults({ created, updated, failed, errorLog });
      setStep(4);

      if (onImportComplete) {
        onImportComplete();
      }
    } catch (err) {
      console.error('Import failed:', err);
      setError(err.message ||'Import failed. Please try again.');
      setStep(2);
    }
  };

  const handleClose = () => {
    setStep(1);
    setFile(null);
    setParsedData([]);
    setImportResults(null);
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Users size={24} className="text-blue-600" />
            <div>
              <h2 className="text-xl font-bold">Import Users</h2>
              <p className="text-sm text-gray-500">
                {step === 1 && 'Upload a CSV file to bulk import users'}
                {step === 2 && `Review ${parsedData.length} users before importing`}
                {step === 3 && 'Importing users...'}
                {step === 4 && 'Import complete!'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
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
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Upload size={48} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Upload CSV File</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Click to browse or drag and drop your CSV file here
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Choose File
                </button>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <FileText size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-blue-900 mb-1">CSV Format Requirements</div>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Required columns: first_name, last_name, email</li>
                      <li>• Optional columns: role, team, department, title</li>
                      <li>• First row must contain column headers</li>
                      <li>• Use comma-separated values</li>
                    </ul>
                    <button
                      onClick={downloadTemplate}
                      className="mt-3 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
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
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-semibold">Ready to import {parsedData.length} users</div>
                  <div className="text-sm text-gray-600">Review the data below before proceeding</div>
                </div>
              </div>

              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">#</th>
                      <th className="px-3 py-2 text-left font-semibold">First Name</th>
                      <th className="px-3 py-2 text-left font-semibold">Last Name</th>
                      <th className="px-3 py-2 text-left font-semibold">Email</th>
                      <th className="px-3 py-2 text-left font-semibold">Role</th>
                      <th className="px-3 py-2 text-left font-semibold">Team</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.map((row, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-500">{index + 1}</td>
                        <td className="px-3 py-2">{row.first_name}</td>
                        <td className="px-3 py-2">{row.last_name}</td>
                        <td className="px-3 py-2">{row.email}</td>
                        <td className="px-3 py-2">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                            {row.role || 'power_user'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-600">{row.team || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Step 3: Importing */}
          {step === 3 && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <div className="text-lg font-semibold mb-2">Importing users...</div>
              <div className="text-sm text-gray-600">This may take a few moments</div>
            </div>
          )}

          {/* Step 4: Complete */}
          {step === 4 && importResults && (
            <div className="space-y-6">
              <div className="text-center py-6">
                <CheckCircle size={64} className="mx-auto text-green-600 mb-4" />
                <h3 className="text-2xl font-bold mb-2">Import Complete!</h3>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-green-600">{importResults.created}</div>
                  <div className="text-sm text-green-700">Users Created</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-blue-600">{importResults.updated}</div>
                  <div className="text-sm text-blue-700">Users Updated</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-red-600">{importResults.failed}</div>
                  <div className="text-sm text-red-700">Failed</div>
                </div>
              </div>

              {importResults.errorLog && importResults.errorLog.length > 0 && (
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-2 text-red-700">Import Errors</h4>
                  <div className="space-y-1 text-sm max-h-40 overflow-y-auto">
                    {importResults.errorLog.map((err, index) => (
                      <div key={index} className="text-red-600">
                        Row {err.row} ({err.email}): {err.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 flex items-center justify-between">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            {step === 4 ? 'Close' : 'Cancel'}
          </button>

          {step === 2 && (
            <button
              onClick={handleImport}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Import {parsedData.length} Users
            </button>
          )}

          {step === 4 && (
            <button
              onClick={() => {
                setStep(1);
                setFile(null);
                setParsedData([]);
                setImportResults(null);
              }}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Import More Users
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
