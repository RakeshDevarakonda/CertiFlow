import React from 'react';

interface Props {
  status: string;
}

export const StatusBadge: React.FC<Props> = ({ status }) => {
  const getStyle = () => {
    switch (status) {
      case 'VALIDATING':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'VALIDATION_FAILED':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'DISTRICT_PENDING':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'QUALITY_PENDING':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'STATE_PENDING':
        return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      case 'APPROVED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'RETURNED':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'REJECTED':
      case 'CANCELLED':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const getLabel = () => {
    switch (status) {
      case 'VALIDATING':
        return 'Validating (Outbox)';
      case 'VALIDATION_FAILED':
        return 'Validation Failed';
      case 'DISTRICT_PENDING':
        return 'District Review';
      case 'QUALITY_PENDING':
        return 'Quality Review (≥50)';
      case 'STATE_PENDING':
        return 'State Sign-off';
      case 'APPROVED':
        return 'Approved & Issued';
      case 'RETURNED':
        return 'Returned for Fix';
      case 'REJECTED':
        return 'Rejected';
      case 'CANCELLED':
        return 'Cancelled';
      default:
        return status;
    }
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStyle()}`}>
      {getLabel()}
    </span>
  );
};
