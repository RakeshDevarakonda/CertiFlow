import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { Batch } from '../types';
import { CheckCircle2, RotateCcw, RefreshCw, Check } from 'lucide-react';

export const QualityOfficerView: React.FC = () => {
  const [pendingBatches, setPendingBatches] = useState<Batch[]>([]);
  const [approvedBatches, setApprovedBatches] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchQualityBatches = async () => {
    try {
      setLoading(true);
      const [pendingRes, approvedRes] = await Promise.all([
        api.get('/quality/batches/pending'),
        api.get('/quality/batches/approved-by-me')
      ]);
      setPendingBatches(pendingRes.data.data || []);
      setApprovedBatches(approvedRes.data.data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQualityBatches();
    const handleSync = () => fetchQualityBatches();
    window.addEventListener('outbox-processed', handleSync);
    return () => window.removeEventListener('outbox-processed', handleSync);
  }, []);

  const handleApprove = async (batchId: string) => {
    try {
      setActionLoading(batchId);
      await api.post(`/quality/batches/${batchId}/approve`, {
        comment: 'Quality and biometric audit verified.'
      });
      fetchQualityBatches();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Quality approval failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReturn = async (batchId: string) => {
    const comment = prompt('Enter reason for returning batch:');
    if (!comment || !comment.trim()) return;

    try {
      setActionLoading(batchId);
      await api.post(`/quality/batches/${batchId}/return`, { comment: comment.trim() });
      fetchQualityBatches();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Return failed');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quality Scrutiny Dashboard</h1>
          <p className="text-sm text-slate-500">
            Mandatory audit checkpoint for large candidate batches (<strong>≥ 50 candidates</strong>) before State issuance.
          </p>
        </div>
        <button
          onClick={fetchQualityBatches}
          className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 pb-2 text-xs">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center space-x-1.5 ${
            activeTab === 'pending'
              ? 'bg-purple-700 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span>Needs Quality Scrutiny</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'pending' ? 'bg-purple-900 text-white' : 'bg-slate-100 text-slate-700'}`}>
            {pendingBatches.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('approved')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center space-x-1.5 ${
            activeTab === 'approved'
              ? 'bg-purple-700 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span>Approved By Me</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'approved' ? 'bg-purple-900 text-white' : 'bg-slate-100 text-slate-700'}`}>
            {approvedBatches.length}
          </span>
        </button>
      </div>

      {/* Queue Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 text-sm">
            {activeTab === 'pending' ? 'Large Batches Awaiting Quality Sign-off' : 'Batches Approved by You'}
          </h3>
          <span className="text-xs text-purple-700 font-bold bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
            {activeTab === 'pending' ? `${pendingBatches.length} Pending` : `${approvedBatches.length} Approved`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Batch Number</th>
                <th className="px-6 py-3">Course Name</th>
                <th className="px-6 py-3">Training Centre</th>
                <th className="px-6 py-3">Candidate Size</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {activeTab === 'pending' ? (
                pendingBatches.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-400">
                      No large batches currently pending quality review.
                    </td>
                  </tr>
                ) : (
                  pendingBatches.map((batch) => (
                    <tr key={batch.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4 font-mono font-bold text-slate-900">{batch.batchNumber}</td>
                      <td className="px-6 py-4 font-medium">{batch.courseName}</td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{batch.centre?.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{batch.centre?.district}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold text-xs border border-purple-200">
                          {batch.candidateCount} Candidates
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => handleApprove(batch.id)}
                          disabled={actionLoading === batch.id}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm inline-flex items-center space-x-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Pass Quality</span>
                        </button>
                        <button
                          onClick={() => handleReturn(batch.id)}
                          disabled={actionLoading === batch.id}
                          className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs shadow-sm inline-flex items-center space-x-1"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Return</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )
              ) : (
                approvedBatches.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-400">
                      You haven't approved any batches yet.
                    </td>
                  </tr>
                ) : (
                  approvedBatches.map((batch) => (
                    <tr key={batch.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4 font-mono font-bold text-slate-900">{batch.batchNumber}</td>
                      <td className="px-6 py-4 font-medium">{batch.courseName}</td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{batch.centre?.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{batch.centre?.district}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold text-xs border border-purple-200">
                          {batch.candidateCount} Candidates
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <Check className="w-3 h-3" />
                          <span>Approved by You</span>
                        </span>
                      </td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
