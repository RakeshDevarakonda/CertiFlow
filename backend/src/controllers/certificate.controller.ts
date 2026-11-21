import { Request, Response } from 'express';
import { certificateService } from '../services/certificate.service.js';
import { CertificateStatus } from '@prisma/client';

export class CertificateController {
  // GET /api/v1/certificates
  async listCertificates(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({ success: false, message: 'Unauthorized.' });
        return;
      }

      const { status, batchId, search, page, limit } = req.query;

      const result = await certificateService.listCertificates({
        userId: user.id,
        userRole: user.role,
        userDistrict: user.district,
        centreId: user.centreId,
        status: status as CertificateStatus | undefined,
        batchId: batchId as string | undefined,
        search: search as string | undefined,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 10
      });

      res.status(200).json({
        success: true,
        data: result.certificates,
        pagination: result.pagination
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to fetch certificates.'
      });
    }
  }

  // GET /api/v1/certificates/:id
  async getCertificateById(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({ success: false, message: 'Unauthorized.' });
        return;
      }

      const { id } = req.params;

      const cert = await certificateService.getCertificateById(
        id,
        user.role,
        user.district,
        user.centreId
      );

      res.status(200).json({
        success: true,
        data: cert
      });
    } catch (error: any) {
      const status = error.message?.includes('Forbidden') ? 403 : 404;
      res.status(status).json({
        success: false,
        message: error.message || 'Certificate not found.'
      });
    }
  }

  // GET /api/v1/certificates/:id/view - Stream inline PDF in browser (Public or Authenticated)
  async viewCertificatePdf(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const user = req.user; // Optional

      const { pdfBuffer, filename } = await certificateService.generateCertificatePdf(
        id,
        user?.role,
        user?.district,
        user?.centreId
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.end(pdfBuffer);
    } catch (error: any) {
      const status = error.message?.includes('Forbidden') ? 403 : 404;
      res.status(status).json({
        success: false,
        message: error.message || 'Failed to generate certificate PDF.'
      });
    }
  }

  // GET /api/v1/certificates/:id/download - Force file attachment download (Public or Authenticated)
  async downloadCertificatePdf(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const user = req.user; // Optional

      const { pdfBuffer, filename } = await certificateService.generateCertificatePdf(
        id,
        user?.role,
        user?.district,
        user?.centreId
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.end(pdfBuffer);
    } catch (error: any) {
      const status = error.message?.includes('Forbidden') ? 403 : 404;
      res.status(status).json({
        success: false,
        message: error.message || 'Failed to download certificate PDF.'
      });
    }
  }
}

export const certificateController = new CertificateController();
