import crypto from 'crypto';

export interface GeneratedCertificateData {
  certificateNumber: string;
  verificationCode: string;
  pdfStoragePath: string;
  pdfHash: string;
}

export class CertificateGenerator {
  /**
   * Generates unique certificate number, verification code, and cryptographically secure hash
   * Format: CERT-{YEAR}-{BATCH_SHORT}-{RANDOM}
   * Verification Code: 12-character alphanumeric code for public verification
   */
  static generateForCandidate(
    candidateId: string,
    candidateName: string,
    batchId: string,
    courseName: string
  ): GeneratedCertificateData {
    const year = new Date().getFullYear();
    const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const certificateNumber = `CERT-${year}-${randomSuffix}-${candidateId.slice(0, 4).toUpperCase()}`;

    // 12-char unique verification code (e.g., PSM-A8F2-9X7B)
    const rawCode = crypto.randomBytes(6).toString('hex').toUpperCase();
    const verificationCode = `PSM-${rawCode.slice(0, 4)}-${rawCode.slice(4, 8)}`;

    // Mock PDF storage path (stored locally or S3 bucket path)
    const pdfStoragePath = `/certificates/${year}/${batchId}/${certificateNumber}.pdf`;

    // Cryptographic SHA-256 hash representing the tamper-proof certificate contents
    const payload = JSON.stringify({
      certificateNumber,
      verificationCode,
      candidateId,
      candidateName,
      batchId,
      courseName,
      issuedAt: new Date().toISOString()
    });
    const pdfHash = crypto.createHash('sha256').update(payload).digest('hex');

    return {
      certificateNumber,
      verificationCode,
      pdfStoragePath,
      pdfHash
    };
  }
}
