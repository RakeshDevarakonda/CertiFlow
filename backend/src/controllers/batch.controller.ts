import { Request, Response } from 'express';
import { batchService, BatchUploadValidationError } from '../services/batch.service.js';

export class BatchController {
  // 1. POST /api/v1/batches - Create batch + candidates and submit for review
  async createAndSubmitBatch(req: Request, res: Response): Promise<void> {
    try {
      const centreId = req.user?.centreId;
      const userId = req.user?.id;

      if (!centreId || !userId) {
        res.status(403).json({
          success: false,
          message: 'Only registered training centres can create and submit batches.'
        });
        return;
      }

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'Please attach a CSV or Excel spreadsheet file.'
        });
        return;
      }

      const { courseName } = req.body;

      const result = await batchService.createAndSubmitBatch(
        centreId,
        courseName,
        req.file.buffer,
        userId
      );

      res.status(201).json({
        success: true,
        message: `Batch ${result.batch.batchNumber} created with ${result.totalCandidates} candidates and submitted for district review.`,
        data: result
      });
    } catch (error: any) {
      if (error instanceof BatchUploadValidationError) {
        res.status(422).json({
          success: false,
          message: error.message,
          errorCount: error.errors.length,
          errors: error.errors
        });
        return;
      }

      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create and submit batch.'
      });
    }
  }

  // 2. GET /api/v1/batches - Get batches belonging to the logged-in centre (paginated)
  async getMyBatches(req: Request, res: Response): Promise<void> {
    try {
      const centreId = req.user?.centreId;

      if (!centreId) {
        res.status(403).json({
          success: false,
          message: 'Only training centres can view their batches.'
        });
        return;
      }

      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

      const result = await batchService.getCentreBatches(centreId, page, limit);

      res.status(200).json({
        success: true,
        data: result.batches,
        pagination: result.pagination
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to retrieve batches.'
      });
    }
  }

  // 3. GET /api/v1/batches/:id - Get batch details, candidates, and approvals history
  async getBatchById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const centreId = req.user?.centreId || undefined;

      const batch = await batchService.getBatchById(id, centreId);

      res.status(200).json({
        success: true,
        data: batch
      });
    } catch (error: any) {
      const status = error.message?.includes('Forbidden') ? 403 : 404;
      res.status(status).json({
        success: false,
        message: error.message || 'Batch not found.'
      });
    }
  }

  // GET /api/v1/batches/:id/candidates - View paginated candidates of a batch
  async getCandidates(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const centreId = req.user?.centreId || undefined;

      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

      const result = await batchService.getCandidates(id, centreId, page, limit);

      res.status(200).json({
        success: true,
        data: result.candidates,
        pagination: result.pagination
      });
    } catch (error: any) {
      const status = error.message?.includes('Forbidden') ? 403 : 404;
      res.status(status).json({
        success: false,
        message: error.message || 'Candidates not found.'
      });
    }
  }

  // 4. PUT /api/v1/batches/:id - Fix and resubmit returned batch (Moment 6)
  async resubmitBatch(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const centreId = req.user?.centreId;
      const userId = req.user?.id;

      if (!centreId || !userId) {
        res.status(403).json({
          success: false,
          message: 'Only training centres can resubmit batches.'
        });
        return;
      }

      const { courseName } = req.body;
      const fileBuffer = req.file ? req.file.buffer : undefined;

      const result = await batchService.resubmitBatch(
        id,
        centreId,
        userId,
        fileBuffer,
        courseName
      );

      res.status(200).json({
        success: true,
        message: result.message,
        data: result.batch
      });
    } catch (error: any) {
      if (error instanceof BatchUploadValidationError) {
        res.status(422).json({
          success: false,
          message: error.message,
          errorCount: error.errors.length,
          errors: error.errors
        });
        return;
      }

      res.status(400).json({
        success: false,
        message: error.message || 'Failed to resubmit batch.'
      });
    }
  }
}

export const batchController = new BatchController();
