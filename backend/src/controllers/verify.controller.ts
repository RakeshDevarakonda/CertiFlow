import { Request, Response } from 'express';
import { verifyService } from '../services/verify.service.js';

export class VerifyController {
  // GET /api/v1/verify/:code - Public unauthenticated verification
  async verifyCertificate(req: Request, res: Response): Promise<void> {
    try {
      const { code } = req.params;

      const result = await verifyService.verifyCertificate(code);

      res.status(200).json({
        success: true,
        message: result.valid
          ? 'Certificate is valid and active.'
          : 'Certificate is officially CANCELLED.',
        data: result
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        message: error.message || 'Certificate not found.'
      });
    }
  }
}

export const verifyController = new VerifyController();
