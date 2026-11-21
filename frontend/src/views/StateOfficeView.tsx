import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { Batch } from '../types';
import { Award, Clock, Ban, RefreshCw } from 'lucide-react';

export const StateOfficeView: React.FC = () => {
  const [pendingBatches, setPendingBatches] = useState<Batch[]>([]);
  const [stuckBatches, setStuckBatches] = useState<any[]>([]);
  const [outboxStats, setOutboxStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Cancellation modal
  const [cancelCode, setCancelCode] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [pendingRes, stuckRes, outboxRes] = await Promise.all([
        api.get('/state/batches/pending'),
        api.get('/state/sla/stuck-batches?hours=0'),
        api.get('/outbox/status')
      ]);

      setPendingBatches(pendingRes.data.data || []);
      setStuckBatches(stuckRes.data.data || []);
      setOutboxStats(outboxRes.data.data || null);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const handleSync = () => fetchData();
    window.addEventListener('outbox-processed', handleSync);
    return () => window.removeEventListener('outbox-processed', handleSync);
  }, []);

  const handleFinalApproval = async (batchId: string) => {
    try {
      setApprovingId(batchId);
      const res = await api.post(`/state/batches/${batchId}/approve`, {
        comment: 'Final State Director seal of approval.'
      });

      alert(`Success: ${res.data.data?.certificatesIssued} certificates generated and queued for WhatsApp delivery!`);

      // Trigger outbox worker to deliver WhatsApp messages immediately
      await api.post('/outbox/process', { batchSize: 50 });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Final approval failed');
    } finally {
      setApprovingId(null);
    }
  };

  const handleCancelCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelCode.trim() || !cancelReason.trim()) return;

    try {
      setCancelling(true);
      // Find certificate by code or ID
      const allCertsRes = await api.get('/certificates?page=1&limit=50');
      const target = allCertsRes.data.data?.find(
        (c: any) => c.verificationCode === cancelCode.trim().toUpperCase() || c.id === cancelCode.trim()
      );

      if (!target) {
        alert('Certificate not found. Please verify code.');
        return;
      }

      await api.post(`/state/certificates/${target.id}/cancel`, {
        reason: cancelReason.trim()
      });

      alert(`Certificate ${target.certificateNumber} officially CANCELLED.`);
      setCancelCode('');
      setCancelReason('');
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to cancel certificate.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">State Office Command Center</h1>
          <p className="text-sm text-slate-500">
            Final approval authority, certificate generation, Transactional Outbox delivery, and SLA monitoring.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Outbox & WhatsApp Delivery KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Awaiting Final Seal</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{pendingBatches.length}</div>
          <div className="text-[11px] text-indigo-600 font-medium mt-1">Ready for Issuance</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Outbox Pending Queue</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{outboxStats?.pending || 0}</div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">Async Delivery Events</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">WhatsApp Dispatched</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{outboxStats?.published || 0}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">Delivered via Meta Cloud API</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">SLA Inactivity Alerts</div>
          <div className="text-2xl font-bold text-rose-600 mt-1">{stuckBatches.length}</div>
          <div className="text-[11px] text-rose-600 font-medium mt-1">Moment 5 Watchlist</div>
        </div>
      </div>

      {/* Pending Final Approvals (Moment 3) */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 text-sm flex items-center space-x-2">
            <Award className="w-4 h-4 text-indigo-600" />
            <span>Batches Cleared for Final State Approval & Certificate Issuance (Moment 3)</span>
          </h3>
          <span className="text-xs text-slate-500 font-medium">{pendingBatches.length} Batches</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Batch Number</th>
                <th className="px-6 py-3">Course Name</th>
                <th className="px-6 py-3">Training Centre</th>
                <th className="px-6 py-3">Candidate Count</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {pendingBatches.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-400">
                    No batches currently awaiting state final approval.
                  </td>
                </tr>
              ) : (
                pendingBatches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 font-mono font-bold text-slate-900">{batch.batchNumber}</td>
                    <td className="px-6 py-4 font-medium">{batch.courseName}</td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800">{batch.centre?.name}</div>
                      <div className="text-[11px] text-slate-400">{batch.centre?.district}</div>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">{batch.candidateCount} students</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleFinalApproval(batch.id)}
                        disabled={approvingId === batch.id}
                        className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm inline-flex items-center space-x-1.5"
                      >
                        <Award className="w-4 h-4" />
                        <span>{approvingId === batch.id ? 'Issuing...' : 'Grant Final Approval & Issue'}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two Column Section: SLA Stuck Batches (Moment 5) & Certificate Revocation (Moment 4) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* SLA Breach Monitor (Moment 5) */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 text-sm flex items-center space-x-2">
              <Clock className="w-4 h-4 text-rose-600" />
              <span>SLA Inactivity & Stuck Batches (Moment 5)</span>
            </h3>
            <span className="text-[11px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded font-bold border border-rose-200">
              {stuckBatches.length} delayed
            </span>
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {stuckBatches.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No stuck batches detected.</p>
            ) : (
              stuckBatches.map((sb: any) => (
                <div key={sb.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-mono font-bold text-slate-900">{sb.batchNumber}</div>
                    <div className="text-slate-500 text-[11px]">{sb.courseName}</div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px]">
                      {sb.hoursInactive}h Inactive
                    </span>
                    <div className="text-[10px] text-slate-400 mt-0.5">{sb.status}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Certificate Revocation Form (Moment 4) */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold text-slate-800 text-sm flex items-center space-x-2 mb-4">
            <Ban className="w-4 h-4 text-rose-600" />
            <span>Revoke / Cancel Certificate (Moment 4)</span>
          </h3>
          <form onSubmit={handleCancelCertificate} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Verification Code or Certificate ID
              </label>
              <input
                type="text"
                required
                placeholder="e.g. PSM-7368-75C0"
                value={cancelCode}
                onChange={(e) => setCancelCode(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Official Cancellation Reason
              </label>
              <textarea
                required
                rows={2}
                placeholder="e.g. Biometric identity audit revealed ghost candidate attendance."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={cancelling}
              className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow transition disabled:opacity-50"
            >
              {cancelling ? 'Revoking...' : 'Confirm Certificate Revocation'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
