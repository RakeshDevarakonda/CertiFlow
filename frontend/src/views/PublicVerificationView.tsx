import React, { useState } from 'react';
import { api } from '../services/api';
import type { CertificateVerification } from '../types';
import { ShieldCheck, Search, FileText, Download, AlertOctagon, CheckCircle2 } from 'lucide-react';

export const PublicVerificationView: React.FC = () => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CertificateVerification | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const res = await api.get(`/verify/${code.trim().toUpperCase()}`);
      setResult(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Certificate not found. Please double check the code.');
    } finally {
      setLoading(false);
    }
  };

  const getPdfViewUrl = (verificationCode: string) => {
    const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
    return `${base}/certificates/${verificationCode}/view`;
  };

  const getPdfDownloadUrl = (verificationCode: string) => {
    const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
    return `${base}/certificates/${verificationCode}/download`;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex p-3 rounded-full bg-indigo-50 border border-indigo-100 mb-2">
          <ShieldCheck className="w-8 h-8 text-indigo-600" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Public Certificate Verification Portal
        </h1>
        <p className="text-sm text-slate-500 max-w-xl mx-auto">
          Verify skilling credentials issued under the Pragati Skills Mission. Authenticated in real-time with zero PII exposure (Moment 4).
        </p>
      </div>

      {/* Search Bar Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <form onSubmit={handleVerify} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              required
              placeholder="Enter 12-character Verification Code (e.g. PSM-XXXX-XXXX)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full text-sm pl-11 pr-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono uppercase"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow transition disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {loading ? 'Verifying...' : 'Verify Certificate'}
          </button>
        </form>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 text-rose-800 text-sm flex items-start space-x-3">
          <AlertOctagon className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold">Verification Failed</h4>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Verification Result Card */}
      {result && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-lg">
          {/* Status Header Banner */}
          <div className={`px-6 py-4 flex items-center justify-between ${result.valid ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
            <div className="flex items-center space-x-2">
              {result.valid ? (
                <>
                  <CheckCircle2 className="w-6 h-6 text-emerald-200" />
                  <div>
                    <h3 className="font-bold text-base">Valid & Authenticated Certificate</h3>
                    <p className="text-xs text-emerald-100">Officially certified by Pragati Skills Mission</p>
                  </div>
                </>
              ) : (
                <>
                  <AlertOctagon className="w-6 h-6 text-rose-200" />
                  <div>
                    <h3 className="font-bold text-base">OFFICIALLY CANCELLED / REVOKED</h3>
                    <p className="text-xs text-rose-100">This credential has been revoked by State Authority</p>
                  </div>
                </>
              )}
            </div>
            <span className="font-mono text-xs px-3 py-1 rounded-full bg-white/20 font-bold uppercase tracking-wider">
              {result.status}
            </span>
          </div>

          {/* Cancellation Notice if Cancelled */}
          {!result.valid && result.cancellationDetails && (
            <div className="bg-rose-50 border-b border-rose-200 p-4 text-xs text-rose-900">
              <strong className="block font-semibold mb-1">Revocation Notice:</strong>
              Reason: <em>"{result.cancellationDetails.reason}"</em>
            </div>
          )}

          {/* Details Table */}
          <div className="p-6 space-y-4 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-slate-100">
              <div>
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Candidate Name</span>
                <span className="text-base font-bold text-slate-900">{result.candidateName}</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">Zero PII Policy: Contact details hidden</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Course / Qualification</span>
                <span className="text-base font-semibold text-slate-800">{result.courseName}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-slate-100 text-xs">
              <div>
                <span className="text-slate-400 font-semibold uppercase tracking-wider block">Certificate Number</span>
                <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">{result.certificateNumber}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold uppercase tracking-wider block">Verification Code</span>
                <span className="font-mono font-bold text-indigo-600 text-sm mt-0.5 block">{result.verificationCode}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold uppercase tracking-wider block">Issued Date</span>
                <span className="font-medium text-slate-700 mt-0.5 block">{new Date(result.issuedAt).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pb-4 border-b border-slate-100">
              <div>
                <span className="text-slate-400 font-semibold uppercase tracking-wider block">Training Centre</span>
                <span className="font-semibold text-slate-800">{result.trainingCentre.name}</span>
                <span className="text-slate-400 block">{result.trainingCentre.district}, {result.trainingCentre.state}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold uppercase tracking-wider block">Batch Number</span>
                <span className="font-mono text-slate-800">{result.batchNumber}</span>
              </div>
            </div>

            {/* Actions: View & Download PDF */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <a
                href={getPdfViewUrl(result.verificationCode)}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs shadow-sm flex items-center justify-center space-x-2 transition"
              >
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>View Official PDF in Browser</span>
              </a>
              <a
                href={getPdfDownloadUrl(result.verificationCode)}
                download
                className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow flex items-center justify-center space-x-2 transition"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF Certificate</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
