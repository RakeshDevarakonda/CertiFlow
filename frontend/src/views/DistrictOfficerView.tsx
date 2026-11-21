import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { CheckCircle2, RotateCcw, XCircle, Users, RefreshCw, Clock } from 'lucide-react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';

export const DistrictOfficerView: React.FC = () => {
  const { user, activePersona } = useSelector((state: RootState) => state.auth);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filter tab: "Needs My Review" vs "Approved By Me (Waiting for Officer 2)"
  const [activeTab, setActiveTab] = useState<'actionable' | 'voted' | 'all'>('actionable');

  // Return modal
  const [returnBatchId, setReturnBatchId] = useState<string | null>(null);
  const [returnComment, setReturnComment] = useState('');

  const fetchPendingBatches = async () => {
    try {
      setLoading(true);
      const res = await api.get('/district/batches/pending');
      setBatches(res.data.data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingBatches();
    const handleSync = () => fetchPendingBatches();
    window.addEventListener('outbox-processed', handleSync);
    return () => window.removeEventListener('outbox-processed', handleSync);
  }, [activePersona?.id]);

  const handleApprove = async (batchId: string) => {
    try {
      setActionLoading(batchId);
      await api.post(`/district/batches/${batchId}/approve`, {});
      await fetchPendingBatches();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Approval failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReturn = async (batchId: string) => {
    if (!returnComment.trim()) {
      alert('A comment explaining the reason for return is required.');
      return;
    }

    try {
      setActionLoading(batchId);
      await api.post(`/district/batches/${batchId}/return`, { comment: returnComment });
      setReturnBatchId(null);
      setReturnComment('');
      await fetchPendingBatches();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Return failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (batchId: string) => {
    const reason = prompt('Enter permanent rejection reason:');
    if (!reason || !reason.trim()) return;

    try {
      setActionLoading(batchId);
      await api.post(`/district/batches/${batchId}/reject`, { comment: reason.trim() });
      await fetchPendingBatches();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Rejection failed');
    } finally {
      setActionLoading(null);
    }
  };

  // Filter batches based on current officer's vote
  const actionableBatches = batches.filter((b) => !b.quorumStatus?.hasOfficerApproved);
  const votedBatches = batches.filter((b) => b.quorumStatus?.hasOfficerApproved);

  const displayedBatches =
    activeTab === 'actionable'
      ? actionableBatches
      : activeTab === 'voted'
      ? votedBatches
      : batches;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">District Officer Review Desk</h1>
          <p className="text-xs text-slate-500">
            Reviewing batches for <strong className="text-blue-700 font-semibold">{user?.district || activePersona?.district || 'District'}</strong> (Moment 2: Quorum ≥ 2 required).
          </p>
        </div>
        <button
          onClick={fetchPendingBatches}
          className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Quorum Info Banner */}
      <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 flex items-start space-x-3 text-xs text-blue-900">
        <Users className="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold">Multi-Officer Quorum Rule:</span> Every batch requires <strong>2 approvals</strong> from distinct officers in this district. Once you approve, the batch awaits the second officer before automatically moving to State / Quality review.
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 pb-2 text-xs">
        <button
          onClick={() => setActiveTab('actionable')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center space-x-1.5 ${
            activeTab === 'actionable'
              ? 'bg-blue-700 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span>Needs My Review</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'actionable' ? 'bg-blue-900 text-white' : 'bg-slate-100 text-slate-700'}`}>
            {actionableBatches.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('voted')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center space-x-1.5 ${
            activeTab === 'voted'
              ? 'bg-blue-700 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span>Approved By Me (Waiting for 2nd Officer)</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'voted' ? 'bg-blue-900 text-white' : 'bg-slate-100 text-slate-700'}`}>
            {votedBatches.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('all')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition ${
            activeTab === 'all'
              ? 'bg-blue-700 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          All District Batches ({batches.length})
        </button>
      </div>

      {/* Batches Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 text-xs uppercase tracking-wider">
            {activeTab === 'actionable'
              ? 'Batches Awaiting Your Vote'
              : activeTab === 'voted'
              ? 'Your Approved Batches (Awaiting Second Officer Sign-off)'
              : 'All Pending District Batches'}
          </h3>
          <span className="text-xs text-slate-500 font-medium">Count: {displayedBatches.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-5 py-3">Batch Details</th>
                <th className="px-5 py-3">Training Centre</th>
                <th className="px-5 py-3">Candidates</th>
                <th className="px-5 py-3">Quorum Progress</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {displayedBatches.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-400">
                    {activeTab === 'actionable'
                      ? 'No batches currently require your review. All caught up!'
                      : activeTab === 'voted'
                      ? 'No batches currently waiting on a second officer.'
                      : 'No batches pending in this district.'}
                  </td>
                </tr>
              ) : (
                displayedBatches.map((batch) => {
                  const hasUserVoted = !!batch.quorumStatus?.hasOfficerApproved;
                  const votes = batch.quorumStatus?.approvalsCount || 0;

                  return (
                    <tr key={batch.id} className="hover:bg-slate-50 transition">
                      <td className="px-5 py-3.5">
                        <div className="font-mono font-bold text-slate-900">{batch.batchNumber}</div>
                        <div className="text-slate-500 text-[11px] mt-0.5">{batch.courseName}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-slate-800">{batch.centre?.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{batch.centre?.code}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-bold text-slate-900">{batch.candidateCount}</span>
                        {batch.candidateCount >= 50 && (
                          <span className="ml-2 inline-flex items-center px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 font-bold text-[10px]">
                            ≥50 Scrutiny
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center space-x-2">
                          <div className="flex space-x-1">
                            <span className={`w-3 h-3 rounded-full ${votes >= 1 ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                            <span className={`w-3 h-3 rounded-full ${votes >= 2 ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                          </div>
                          <span className="font-semibold text-[11px]">
                            {votes} of 2 Votes
                          </span>
                        </div>
                        {hasUserVoted && (
                          <div className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center space-x-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Approved by you (Waiting for Officer 2)</span>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right space-x-2">
                        {hasUserVoted ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-100 text-slate-600 font-medium text-[11px] border border-slate-200">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>Awaiting 2nd Officer</span>
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => handleApprove(batch.id)}
                              disabled={actionLoading === batch.id}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-semibold text-xs shadow-sm inline-flex items-center space-x-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => setReturnBatchId(batch.id)}
                              disabled={actionLoading === batch.id}
                              className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs shadow-sm inline-flex items-center space-x-1"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Return</span>
                            </button>
                            <button
                              onClick={() => handleReject(batch.id)}
                              disabled={actionLoading === batch.id}
                              className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-red-50 text-red-600 font-semibold text-xs border border-red-200 shadow-sm"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Return Modal */}
      {returnBatchId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-5 border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Return Batch for Corrections</h3>
            <p className="text-xs text-slate-500 mb-3">
              Specify what corrections the Training Centre must make. This moves the batch to <strong>RETURNED</strong> status.
            </p>
            <textarea
              required
              rows={3}
              value={returnComment}
              onChange={(e) => setReturnComment(e.target.value)}
              placeholder="e.g. Candidate Aadhaar attendance mismatched on rows 12-15..."
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none mb-3"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setReturnBatchId(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReturn(returnBatchId)}
                className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-xs font-semibold text-white shadow-sm"
              >
                Confirm Return
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
