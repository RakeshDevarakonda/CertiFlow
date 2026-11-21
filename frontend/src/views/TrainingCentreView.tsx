import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { Batch } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { validateSpreadsheetClient } from '../utils/spreadsheetValidator';
import type { ClientValidationResult } from '../utils/spreadsheetValidator';
import { UploadCloud, AlertTriangle, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';

export const TrainingCentreView: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [clientValidation, setClientValidation] = useState<ClientValidationResult | null>(null);
  const [validatingClient, setValidatingClient] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Resubmit modal state
  const [resubmitBatchId, setResubmitBatchId] = useState<string | null>(null);
  const [resubmitFile, setResubmitFile] = useState<File | null>(null);
  const [resubmitValidation, setResubmitValidation] = useState<ClientValidationResult | null>(null);

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const res = await api.get('/batches?page=1&limit=20');
      setBatches(res.data.data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
    const handleSync = () => fetchBatches();
    window.addEventListener('outbox-processed', handleSync);
    return () => window.removeEventListener('outbox-processed', handleSync);
  }, []);

  // Instant client-side validation whenever a file is selected
  const handleFileChange = async (selectedFile: File | null) => {
    setFile(selectedFile);
    setFeedback(null);

    if (!selectedFile) {
      setClientValidation(null);
      return;
    }

    try {
      setValidatingClient(true);
      const result = await validateSpreadsheetClient(selectedFile);
      setClientValidation(result);
    } catch {
      setClientValidation({
        valid: false,
        totalRows: 0,
        validCandidates: [],
        errors: [{ row: 0, field: 'file', value: '', message: 'Unable to parse file. Please upload a valid CSV, XLSX, or XLS.' }]
      });
    } finally {
      setValidatingClient(false);
    }
  };

  const handleResubmitFileChange = async (selectedFile: File | null) => {
    setResubmitFile(selectedFile);
    if (!selectedFile) {
      setResubmitValidation(null);
      return;
    }

    const result = await validateSpreadsheetClient(selectedFile);
    setResubmitValidation(result);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !courseName.trim()) {
      setFeedback({ type: 'error', message: 'Please provide course name and attach candidate CSV/Excel file.' });
      return;
    }

    if (clientValidation && !clientValidation.valid) {
      setFeedback({
        type: 'error',
        message: `Cannot upload: Found ${clientValidation.errors.length} formatting errors in the spreadsheet. Please correct them before submitting.`
      });
      return;
    }

    try {
      setUploading(true);
      setFeedback(null);
      const formData = new FormData();
      formData.append('courseName', courseName.trim());
      formData.append('file', file);

      const res = await api.post('/batches', formData);
      setFeedback({
        type: 'success',
        message: `${res.data.message} Background validation queued in Transactional Outbox.`
      });
      setCourseName('');
      setFile(null);
      setClientValidation(null);

      // Trigger outbox worker to process validation
      await api.post('/outbox/process', { batchSize: 50 });
      fetchBatches();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to upload batch.'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleResubmit = async (batchId: string) => {
    if (!resubmitFile) {
      alert('Please select a corrected CSV or Excel file.');
      return;
    }

    if (resubmitValidation && !resubmitValidation.valid) {
      alert(`Cannot resubmit: ${resubmitValidation.errors.length} formatting errors found. Please fix them.`);
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', resubmitFile);

      await api.put(`/batches/${batchId}`, formData);
      setResubmitBatchId(null);
      setResubmitFile(null);
      setResubmitValidation(null);

      // Process validation
      await api.post('/outbox/process', { batchSize: 50 });
      fetchBatches();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to resubmit batch.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Training Centre Portal</h1>
          <p className="text-xs text-slate-500">Upload candidate rosters (CSV, XLSX, XLS), review live validation, and track approvals.</p>
        </div>
        <button
          onClick={fetchBatches}
          className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Upload Form Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
          <UploadCloud className="w-4 h-4 text-blue-700" />
          <span>Upload & Submit Candidate Batch (Moment 1)</span>
        </h2>

        {feedback && (
          <div className={`p-3 rounded-lg text-xs font-medium ${feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
            {feedback.message}
          </div>
        )}

        <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-1">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Course / Skill Trade
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Solar PV Installer & Electrician"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-slate-900"
            />
          </div>

          <div className="md:col-span-1">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Candidate Roster (CSV, XLSX, XLS)
            </label>
            <input
              type="file"
              required
              accept=".csv,.xlsx,.xls"
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer border border-slate-300 rounded-lg bg-white"
            />
          </div>

          <div className="md:col-span-1">
            <button
              type="submit"
              disabled={uploading || validatingClient || (clientValidation !== null && !clientValidation.valid)}
              className="w-full py-2 px-4 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-40"
            >
              {uploading ? 'Submitting...' : 'Upload & Submit Batch'}
            </button>
          </div>
        </form>

        {/* Live Client-Side Pre-Upload Validation Preview */}
        {validatingClient && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 flex items-center space-x-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
            <span>Validating candidate rows in browser...</span>
          </div>
        )}

        {clientValidation && (
          <div className={`p-4 rounded-lg border text-xs ${clientValidation.valid ? 'bg-emerald-50/70 border-emerald-200' : 'bg-rose-50/70 border-rose-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-1.5 font-bold">
                {clientValidation.valid ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-900">Pre-Upload Validation Passed: {clientValidation.totalRows} valid candidate rows ready</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <span className="text-rose-900">Validation Block: Found {clientValidation.errors.length} issue(s) across {clientValidation.totalRows} rows</span>
                  </>
                )}
              </div>
              <span className="text-[11px] font-mono text-slate-500">
                {file?.name} ({((file?.size || 0) / 1024).toFixed(1)} KB)
              </span>
            </div>

            {!clientValidation.valid && (
              <div className="mt-2 space-y-1 max-h-36 overflow-y-auto pr-1">
                {clientValidation.errors.slice(0, 10).map((err, i) => (
                  <div key={i} className="text-[11px] text-rose-800 bg-white/70 p-1.5 rounded border border-rose-200 flex items-start space-x-1.5">
                    <span className="font-bold text-rose-600 flex-shrink-0">Row {err.row}:</span>
                    <span>{err.message}</span>
                    {err.value && <span className="font-mono text-[10px] text-slate-500">({err.value})</span>}
                  </div>
                ))}
                {clientValidation.errors.length > 10 && (
                  <div className="text-[10px] text-rose-700 italic">
                    ...and {clientValidation.errors.length - 10} more errors.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Batches Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 text-xs uppercase tracking-wider">Submitted Batches & Status Ledger</h3>
          <span className="text-xs text-slate-500 font-medium">Total: {batches.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-5 py-2.5">Batch Number</th>
                <th className="px-5 py-2.5">Course Name</th>
                <th className="px-5 py-2.5">Candidates</th>
                <th className="px-5 py-2.5">Round</th>
                <th className="px-5 py-2.5">Status</th>
                <th className="px-5 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-slate-400">
                    No batches uploaded yet. Upload a sample CSV or Excel file above.
                  </td>
                </tr>
              ) : (
                batches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-3 font-mono font-medium text-slate-900">{batch.batchNumber}</td>
                    <td className="px-5 py-3 font-medium">{batch.courseName}</td>
                    <td className="px-5 py-3">
                      <span className="font-semibold text-slate-900">{batch.candidateCount}</span> students
                    </td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold text-[11px] border border-slate-200">
                        Round {batch.approvalRound}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={batch.status} />
                      {batch.status === 'VALIDATION_FAILED' && batch.validationErrors && (
                        <div className="mt-1 text-[11px] text-rose-600 flex items-center space-x-1">
                          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                          <span>{batch.validationErrors.length} errors recorded</span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {batch.status === 'RETURNED' && (
                        <button
                          onClick={() => setResubmitBatchId(batch.id)}
                          className="px-2.5 py-1 rounded bg-orange-600 hover:bg-orange-700 text-white font-semibold text-[11px] shadow-sm"
                        >
                          Fix & Resubmit
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resubmit Modal */}
      {resubmitBatchId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-5 border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Fix & Resubmit Batch (Moment 6)</h3>
            <p className="text-xs text-slate-500 mb-3">
              Upload the corrected CSV or Excel spreadsheet. Live validation will verify rows before submission.
            </p>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => handleResubmitFileChange(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer border border-slate-300 rounded-lg mb-3"
            />

            {resubmitValidation && (
              <div className={`p-3 rounded-lg text-xs mb-3 border ${resubmitValidation.valid ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
                {resubmitValidation.valid ? (
                  <span>✓ {resubmitValidation.totalRows} valid candidates ready.</span>
                ) : (
                  <span>❌ {resubmitValidation.errors.length} formatting errors detected. Please fix.</span>
                )}
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setResubmitBatchId(null);
                  setResubmitFile(null);
                  setResubmitValidation(null);
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleResubmit(resubmitBatchId)}
                disabled={uploading || (resubmitValidation !== null && !resubmitValidation.valid)}
                className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-xs font-semibold text-white shadow-sm disabled:opacity-50"
              >
                {uploading ? 'Resubmitting...' : 'Confirm Resubmission'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
