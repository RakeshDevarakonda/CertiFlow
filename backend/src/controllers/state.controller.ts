import { Request, Response } from 'express';
import { stateService } from '../services/state.service.js';

export class StateController {
  // 1. GET /api/v1/state/batches/pending
  async getPendingBatches(req: Request, res: Response): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

      const result = await stateService.getPendingStateBatches(page, limit);

      res.status(200).json({
        success: true,
        data: result.batches,
        pagination: result.pagination
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to fetch pending state batches.'
      });
    }
  }

  // 1.1 GET /api/v1/state/batches/approved-by-me
  async getApprovedByMeBatches(req: Request, res: Response): Promise<void> {
    try {
      const officerId = req.user?.id;
      if (!officerId) {
        res.status(401).json({ success: false, message: 'Unauthorized.' });
        return;
      }

      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const result = await stateService.getApprovedByMeBatches(officerId, page, limit);

      res.status(200).json({
        success: true,
        data: result.batches,
        pagination: result.pagination
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to fetch approved batches.'
      });
    }
  }

  // 2. POST /api/v1/state/batches/:id/approve - Final Approval & Certificate Issuance
  async approveBatch(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const officerId = req.user?.id;

      if (!officerId) {
        res.status(401).json({ success: false, message: 'Unauthorized.' });
        return;
      }

      const { comment } = req.body;

      const result = await stateService.approveBatchAndIssueCertificates(id, officerId, comment);

      res.status(200).json({
        success: true,
        message: result.message,
        data: result
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to approve batch.'
      });
    }
  }

  // 3. POST /api/v1/state/batches/:id/return
  async returnBatch(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const officerId = req.user?.id;

      if (!officerId) {
        res.status(401).json({ success: false, message: 'Unauthorized.' });
        return;
      }

      const { comment } = req.body;

      const result = await stateService.returnBatch(id, officerId, comment);

      res.status(200).json({
        success: true,
        message: result.message,
        data: result
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to return batch.'
      });
    }
  }

  // 4. POST /api/v1/state/batches/:id/reject
  async rejectBatch(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const officerId = req.user?.id;

      if (!officerId) {
        res.status(401).json({ success: false, message: 'Unauthorized.' });
        return;
      }

      const { comment } = req.body;

      const result = await stateService.rejectBatch(id, officerId, comment);

      res.status(200).json({
        success: true,
        message: result.message,
        data: result
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to reject batch.'
      });
    }
  }

  // 5. POST /api/v1/state/certificates/:id/cancel - Moment 4
  async cancelCertificate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const officerId = req.user?.id;

      if (!officerId) {
        res.status(401).json({ success: false, message: 'Unauthorized.' });
        return;
      }

      const { reason } = req.body;

      const result = await stateService.cancelCertificate(id, officerId, reason);

      res.status(200).json({
        success: true,
        message: result.message,
        data: result.certificate
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to cancel certificate.'
      });
    }
  }

  // 6. GET /api/v1/state/sla/stuck-batches - Moment 5
  async getStuckBatches(req: Request, res: Response): Promise<void> {
    try {
      const hours = req.query.hours ? parseInt(req.query.hours as string, 10) : 48;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

      const result = await stateService.getStuckBatches(hours, page, limit);

      res.status(200).json({
        success: true,
        data: result.batches,
        sla: {
          thresholdHours: result.thresholdHours,
          totalBreached: result.totalBreached
        },
        pagination: result.pagination
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to fetch stuck batches.'
      });
    }
  }
}

export const stateController = new StateController();
