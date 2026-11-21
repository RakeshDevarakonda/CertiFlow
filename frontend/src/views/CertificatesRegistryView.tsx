import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Award, Search, FileText, Download, CheckCircle2, AlertOctagon, RefreshCw } from 'lucide-react';

export const CertificatesRegistryView: React.FC = () => {
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ISSUED' | 'CANCELLED'>('ALL');

  const fetchCertificates = async () => {
    try {
      setLoading(true);
      const res = await api.get('/certificates?page=1&limit=50');
      setCertificates(res.data.data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCertificates();
    const handleSync = () => fetchCertificates();
    window.addEventListener('outbox-processed', handleSync);
    return () => window.removeEventListener('outbox-processed', handleSync);
  }, []);

  const getPdfViewUrl = (verificationCode: string) => {
    const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
    return `${base}/certificates/${verificationCode}/view`;
  };

  const getPdfDownloadUrl = (verificationCode: string) => {
    const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
    return `${base}/certificates/${verificationCode}/download`;
  };

  const filteredCertificates = certificates.filter((c) => {
    const matchesSearch =
      c.certificateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.verificationCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.candidate?.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.batch?.courseName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL' ? true : c.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Official Certificate Registry</h1>
          <p className="text-xs text-slate-500">
            View, inspect, and download official PDF certificates issued across all training batches.
          </p>
        </div>
        <button
          onClick={fetchCertificates}
          className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by candidate name, certificate #, verification code, or course..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-slate-900"
          />
        </div>

        <div className="flex space-x-1.5 w-full sm:w-auto">
          {(['ALL', 'ISSUED', 'CANCELLED'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === filter
                  ? 'bg-blue-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {filter === 'ALL' ? 'All' : filter === 'ISSUED' ? 'Active' : 'Cancelled'}
            </button>
          ))}
        </div>
      </div>

      {/* Certificates Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 text-xs uppercase tracking-wider flex items-center space-x-1.5">
            <Award className="w-4 h-4 text-blue-700" />
            <span>Issued Certificates</span>
          </h3>
          <span className="text-xs text-slate-500 font-medium">
            Showing {filteredCertificates.length} of {certificates.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-5 py-3">Certificate Number</th>
                <th className="px-5 py-3">Verification Code</th>
                <th className="px-5 py-3">Candidate Name</th>
                <th className="px-5 py-3">Course / Trade</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">PDF Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {filteredCertificates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    {certificates.length === 0
                      ? 'No certificates issued yet. Batches approved by State Office will appear here.'
                      : 'No certificates matched your search filter.'}
                  </td>
                </tr>
              ) : (
                filteredCertificates.map((cert) => {
                  const isCancelled = cert.status === 'CANCELLED';

                  return (
                    <tr key={cert.id} className="hover:bg-slate-50 transition">
                      <td className="px-5 py-3.5 font-mono font-bold text-slate-900">{cert.certificateNumber}</td>
                      <td className="px-5 py-3.5 font-mono font-bold text-blue-700">{cert.verificationCode}</td>
                      <td className="px-5 py-3.5 font-semibold text-slate-800">{cert.candidate?.fullName}</td>
                      <td className="px-5 py-3.5 text-slate-600">{cert.batch?.courseName}</td>
                      <td className="px-5 py-3.5">
                        {isCancelled ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            <AlertOctagon className="w-3 h-3 text-rose-600" />
                            <span>CANCELLED</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>ACTIVE</span>
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right space-x-2">
                        {/* Inline View Button */}
                        <a
                          href={getPdfViewUrl(cert.verificationCode)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-sm transition"
                          title="View PDF inline in browser"
                        >
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                          <span>View</span>
                        </a>

                        {/* Direct Download Button */}
                        <a
                          href={getPdfDownloadUrl(cert.verificationCode)}
                          download
                          className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs shadow-sm transition"
                          title="Download official PDF file"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </a>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
