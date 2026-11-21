import { Request, Response } from 'express';
import { districtService } from '../services/district.service.js';

export class DistrictController {
  // 1. GET /api/v1/district/batches/pending - List batches awaiting district approval
  async getPendingBatches(req: Request, res: Response): Promise<void> {
    try {
      const officerDistrict = req.user?.district;
      const officerId = req.user?.id;

      if (!officerDistrict || !officerId) {
        res.status(403).json({
          success: false,
          message: 'Only district officers with an assigned district can view this queue.'
        });
        return;
      }

      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

      const result = await districtService.getPendingDistrictBatches(
        officerDistrict,
        officerId,
        page,
        limit
      );

      res.status(200).json({
        success: true,
        data: result.batches,
        pagination: result.pagination
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to fetch pending batches.'
      });
    }
  }

  // 2. POST /api/v1/district/batches/:id/decision - Unified Decision (APPROVED | RETURNED | REJECTED)
  async recordDecision(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const officerDistrict = req.user?.district;
      const officerId = req.user?.id;

      if (!officerDistrict || !officerId) {
        res.status(403).json({
          success: false,
          message: 'Only district officers can record review decisions.'
        });
        return;
      }

      const { action, comment } = req.body;

      const result = await districtService.recordDecision(
        id,
        officerId,
        officerDistrict,
        action,
        comment
      );

      res.status(200).json({
        success: true,
        message: result.message,
        data: result
      });
    } catch (error: any) {
      const status = error.message?.includes('Forbidden') ? 403 : 400;
      res.status(status).json({
        success: false,
        message: error.message || 'Failed to record decision.'
      });
    }
  }

  // 3. POST /api/v1/district/batches/:id/approve - Approve batch
  async approveBatch(req: Request, res: Response): Promise<void> {
    req.body.action = 'APPROVED';
    return this.recordDecision(req, res);
  }

  // 4. POST /api/v1/district/batches/:id/return - Return batch for correction
  async returnBatch(req: Request, res: Response): Promise<void> {
    req.body.action = 'RETURNED';
    return this.recordDecision(req, res);
  }

  // 5. POST /api/v1/district/batches/:id/reject - Reject batch
  async rejectBatch(req: Request, res: Response): Promise<void> {
    req.body.action = 'REJECTED';
    return this.recordDecision(req, res);
  }
}

export const districtController = new DistrictController();
