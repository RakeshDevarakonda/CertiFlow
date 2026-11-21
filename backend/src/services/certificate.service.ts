import { CertificateStatus, Role } from '@prisma/client';
import { prisma } from '../config/db.js';
import { CertificatePdfRenderer } from '../utils/pdf.renderer.js';

export interface ListCertificatesParams {
  userId: string;
  userRole: Role;
  userDistrict?: string | null;
  centreId?: string | null;
  status?: CertificateStatus;
  batchId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export class CertificateService {
  // GET /api/v1/certificates - Paginated list of issued/cancelled certificates with role-based scoping
  async listCertificates(params: ListCertificatesParams) {
    const {
      userRole,
      userDistrict,
      centreId,
      status,
      batchId,
      search,
      page = 1,
      limit = 10
    } = params;

    const skip = (page - 1) * limit;

    // Role-based scoping
    const where: any = {};

    if (userRole === Role.TRAINING_CENTRE) {
      if (!centreId) {
        throw new Error('Training centre profile not found.');
      }
      where.batch = { centreId };
    } else if (userRole === Role.DISTRICT_OFFICER) {
      if (!userDistrict) {
        throw new Error('District officer has no assigned district.');
      }
      where.batch = {
        centre: { district: userDistrict }
      };
    }
    // STATE_OFFICE & QUALITY_OFFICER can view certificates statewide

    // Filters
    if (status) {
      where.status = status;
    }

    if (batchId) {
      where.batchId = batchId;
    }

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { certificateNumber: { contains: term, mode: 'insensitive' } },
        { verificationCode: { contains: term, mode: 'insensitive' } },
        { candidate: { fullName: { contains: term, mode: 'insensitive' } } }
      ];
    }

    const [total, certificates] = await prisma.$transaction([
      prisma.certificate.count({ where }),
      prisma.certificate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { issuedAt: 'desc' },
        include: {
          candidate: {
            select: {
              id: true,
              fullName: true,
              phoneNumber: true,
              email: true
            }
          },
          batch: {
            select: {
              id: true,
              batchNumber: true,
              courseName: true,
              centre: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  district: true,
                  state: true
                }
              }
            }
          },
          cancelledBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          deliveryLogs: {
            select: {
              id: true,
              channel: true,
              status: true,
              createdAt: true
            },
            take: 1,
            orderBy: { createdAt: 'desc' }
          }
        }
      })
    ]);

    const formatted = certificates.map((cert) => ({
      id: cert.id,
      certificateNumber: cert.certificateNumber,
      verificationCode: cert.verificationCode,
      status: cert.status,
      issuedAt: cert.issuedAt,
      pdfStoragePath: cert.pdfStoragePath,
      pdfHash: cert.pdfHash,
      candidate: {
        id: cert.candidate.id,
        fullName: cert.candidate.fullName,
        phoneNumber: cert.candidate.phoneNumber,
        email: cert.candidate.email
      },
      batch: {
        id: cert.batch.id,
        batchNumber: cert.batch.batchNumber,
        courseName: cert.batch.courseName,
        centre: cert.batch.centre
      },
      cancellation: cert.status === CertificateStatus.CANCELLED
        ? {
            reason: cert.cancellationReason,
            cancelledAt: cert.cancelledAt,
            cancelledBy: cert.cancelledBy ? cert.cancelledBy.name : null
          }
        : null,
      deliveryStatus: cert.deliveryLogs[0]?.status || 'QUEUED'
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      certificates: formatted,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };
  }

  // GET /api/v1/certificates/:id - Single certificate details
  async getCertificateById(id: string, userRole: Role, userDistrict?: string | null, centreId?: string | null) {
    const cert = await prisma.certificate.findUnique({
      where: { id },
      include: {
        candidate: true,
        batch: {
          include: { centre: true }
        },
        cancelledBy: {
          select: { id: true, name: true, email: true }
        },
        deliveryLogs: true
      }
    });

    if (!cert) {
      throw new Error('Certificate not found.');
    }

    // Role check
    if (userRole === Role.TRAINING_CENTRE && cert.batch.centreId !== centreId) {
      throw new Error('Forbidden. You do not own this certificate.');
    }

    if (userRole === Role.DISTRICT_OFFICER && cert.batch.centre.district !== userDistrict) {
      throw new Error(`Forbidden. Certificate belongs to district "${cert.batch.centre.district}".`);
    }

    return cert;
  }

  // GET /api/v1/certificates/:id/pdf - Render dynamic PDF buffer (Public unauthenticated or authenticated)
  async generateCertificatePdf(id: string, userRole?: Role, userDistrict?: string | null, centreId?: string | null) {
    let cert;

    if (userRole) {
      // Authenticated with role boundary checks
      cert = await this.getCertificateById(id, userRole, userDistrict, centreId);
    } else {
      // Public download/view by UUID or verification code
      cert = await prisma.certificate.findFirst({
        where: {
          OR: [
            { id },
            { verificationCode: id.trim().toUpperCase() }
          ]
        },
        include: {
          candidate: true,
          batch: {
            include: { centre: true }
          }
        }
      });
    }

    if (!cert) {
      throw new Error('Certificate not found.');
    }

    const pdfBuffer = await CertificatePdfRenderer.renderToBuffer({
      certificateNumber: cert.certificateNumber,
      verificationCode: cert.verificationCode,
      candidateName: cert.candidate.fullName,
      courseName: cert.batch.courseName,
      centreName: cert.batch.centre.name,
      district: cert.batch.centre.district,
      state: cert.batch.centre.state,
      issuedAt: cert.issuedAt,
      status: cert.status,
      cancellationReason: cert.cancellationReason
    });

    return {
      pdfBuffer,
      filename: `${cert.certificateNumber}.pdf`
    };
  }
}

export const certificateService = new CertificateService();
