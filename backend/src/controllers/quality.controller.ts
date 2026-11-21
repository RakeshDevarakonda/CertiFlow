import { Request, Response } from 'express';
import { qualityService } from '../services/quality.service.js';

export class QualityController {
  // 1. GET /api/v1/quality/batches/pending
  async getPendingBatches(req: Request, res: Response): Promise<void> {
    try {
      const officerId = req.user?.id;
      if (!officerId) {
        res.status(401).json({ success: false, message: 'Unauthorized.' });
        return;
      }

      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

      const result = await qualityService.getPendingQualityBatches(officerId, page, limit);

      res.status(200).json({
        success: true,
        data: result.batches,
        pagination: result.pagination
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to fetch quality pending batches.'
      });
    }
  }

  // 2. POST /api/v1/quality/batches/:id/decision - Unified Decision
  async recordDecision(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const officerId = req.user?.id;

      if (!officerId) {
        res.status(401).json({ success: false, message: 'Unauthorized.' });
        return;
      }

      const { action, comment } = req.body;

      const result = await qualityService.recordDecision(id, officerId, action, comment);

      res.status(200).json({
        success: true,
        message: result.message,
        data: result
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to record quality decision.'
      });
    }
  }

  // 3. POST /api/v1/quality/batches/:id/approve
  async approveBatch(req: Request, res: Response): Promise<void> {
    req.body.action = 'APPROVED';
    return this.recordDecision(req, res);
  }

  // 4. POST /api/v1/quality/batches/:id/return
  async returnBatch(req: Request, res: Response): Promise<void> {
    req.body.action = 'RETURNED';
    return this.recordDecision(req, res);
  }

  // 5. POST /api/v1/quality/batches/:id/reject
  async rejectBatch(req: Request, res: Response): Promise<void> {
    req.body.action = 'REJECTED';
    return this.recordDecision(req, res);
  }
}

export const qualityController = new QualityController();
