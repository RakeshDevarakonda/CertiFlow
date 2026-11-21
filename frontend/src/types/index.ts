export type Role = 'TRAINING_CENTRE' | 'DISTRICT_OFFICER' | 'QUALITY_OFFICER' | 'STATE_OFFICE' | 'PUBLIC';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  district?: string | null;
  state?: string | null;
  centreId?: string | null;
  centre?: {
    id: string;
    name: string;
    code: string;
    district: string;
    state: string;
  } | null;
}

export interface DemoPersona {
  id: string;
  name: string;
  roleTitle: string;
  email: string;
  role: Role;
  district?: string;
  avatarBadge: string;
}

export const DEMO_PERSONAS: DemoPersona[] = [
  {
    id: 'tc-pune',
    name: 'Anika Sharma',
    roleTitle: 'Training Centre (Pune)',
    email: 'anika@certiflow.com',
    role: 'TRAINING_CENTRE',
    district: 'Pune',
    avatarBadge: 'TC'
  },
  {
    id: 'do-pune-1',
    name: 'Dev Patel',
    roleTitle: 'District Officer 1 (Pune)',
    email: 'dev@certiflow.com',
    role: 'DISTRICT_OFFICER',
    district: 'Pune',
    avatarBadge: 'D1'
  },
  {
    id: 'do-pune-2',
    name: 'Meera Deshmukh',
    roleTitle: 'District Officer 2 (Pune)',
    email: 'meera@certiflow.com',
    role: 'DISTRICT_OFFICER',
    district: 'Pune',
    avatarBadge: 'D2'
  },
  {
    id: 'qo-state',
    name: 'Neha Kulkarni',
    roleTitle: 'Quality Scrutiny Officer',
    email: 'neha@certiflow.com',
    role: 'QUALITY_OFFICER',
    avatarBadge: 'QO'
  },
  {
    id: 'so-state',
    name: 'Farah Khan',
    roleTitle: 'State Director',
    email: 'farah@certiflow.com',
    role: 'STATE_OFFICE',
    avatarBadge: 'SO'
  },
  {
    id: 'public-user',
    name: 'Public Citizen',
    roleTitle: 'Public Certificate Verifier',
    email: '',
    role: 'PUBLIC',
    avatarBadge: 'VER'
  }
];

export interface Batch {
  id: string;
  batchNumber: string;
  courseName: string;
  candidateCount: number;
  status: 'VALIDATING' | 'VALIDATION_FAILED' | 'DRAFT' | 'DISTRICT_PENDING' | 'QUALITY_PENDING' | 'STATE_PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED';
  approvalRound: number;
  centreId: string;
  validationErrors?: any[] | null;
  createdAt: string;
  lastActivityAt: string;
  centre?: {
    name: string;
    code: string;
    district: string;
  };
  approvals?: {
    id: string;
    stage: string;
    action: string;
    approvalRound: number;
    comment?: string;
    officer: {
      fullName: string;
      email: string;
      role: string;
    };
    createdAt: string;
  }[];
  candidates?: Candidate[];
}

export interface Candidate {
  id: string;
  fullName: string;
  phoneNumber: string;
  email?: string;
}

export interface CertificateVerification {
  valid: boolean;
  status: 'ACTIVE' | 'CANCELLED';
  certificateNumber: string;
  verificationCode: string;
  candidateName: string;
  courseName: string;
  trainingCentre: {
    name: string;
    code: string;
    district: string;
    state: string;
  };
  batchNumber: string;
  issuedAt: string;
  cancellationDetails?: {
    cancelledAt: string;
    reason: string;
  };
}
