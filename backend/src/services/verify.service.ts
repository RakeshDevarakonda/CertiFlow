import { CertificateStatus } from '@prisma/client';
import { prisma } from '../config/db.js';
import { redis } from '../config/redis.js';

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
    const cacheKey = `cache:verify:${normalizedCode}`;

    // 1. Try Optional Redis Cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // Fallback to DB
      }
    }

    // 2. Query Database directly on PostgreSQL unique index
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

    // 3. Optional Redis Cache Write (TTL 300s, skips if redis is down)
    await redis.set(cacheKey, JSON.stringify(result), 300);

    return result;
  }

  // Instant invalidation helper when a certificate is cancelled
  async invalidateCache(verificationCode: string): Promise<void> {
    const cacheKey = `cache:verify:${verificationCode.trim().toUpperCase()}`;
    await redis.del(cacheKey);
  }
}

export const verifyService = new VerifyService();
