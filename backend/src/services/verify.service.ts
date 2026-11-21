import { CertificateStatus } from '@prisma/client';
import { prisma } from '../config/db.js';

export interface PublicCertificateVerificationResult {
  valid: boolean;
  status: 'ACTIVE' | 'CANCELLED';
  certificateNumber: string;
  verificationCode: string;
  candidateName: string; // ONLY Full Name - zero PII (no phone number, no email)
  courseName: string;
  trainingCentre: {
    name: string;
    code: string;
    district: string;
    state: string;
  };
  batchNumber: string;
  issuedAt: Date;
  pdfHash: string;
  cancellationDetails?: {
    cancelledAt: Date | null;
    reason: string | null;
  };
}

export class VerifyService {
  async verifyCertificate(code: string): Promise<PublicCertificateVerificationResult> {
    const normalizedCode = code.trim().toUpperCase();

    // Query Database directly on PostgreSQL unique index in real-time
    const certificate = await prisma.certificate.findUnique({
      where: { verificationCode: normalizedCode },
      include: {
        candidate: {
          select: {
            fullName: true // NOTE: No phoneNumber, no email - NO PII LEAKED
          }
        },
        batch: {
          select: {
            batchNumber: true,
            courseName: true,
            centre: {
              select: {
                name: true,
                code: true,
                district: true,
                state: true
              }
            }
          }
        }
      }
    });

    if (!certificate) {
      throw new Error(`No certificate found with verification code: ${normalizedCode}`);
    }

    const isCancelled = certificate.status === CertificateStatus.CANCELLED;

    const result: PublicCertificateVerificationResult = {
      valid: !isCancelled,
      status: isCancelled ? 'CANCELLED' : 'ACTIVE',
      certificateNumber: certificate.certificateNumber,
      verificationCode: certificate.verificationCode,
      candidateName: certificate.candidate.fullName,
      courseName: certificate.batch.courseName,
      trainingCentre: {
        name: certificate.batch.centre.name,
        code: certificate.batch.centre.code,
        district: certificate.batch.centre.district,
        state: certificate.batch.centre.state
      },
      batchNumber: certificate.batch.batchNumber,
      issuedAt: certificate.issuedAt,
      pdfHash: certificate.pdfHash,
      ...(isCancelled && {
        cancellationDetails: {
          cancelledAt: certificate.cancelledAt,
          reason: certificate.cancellationReason
        }
      })
    };

    return result;
  }
}

export const verifyService = new VerifyService();
