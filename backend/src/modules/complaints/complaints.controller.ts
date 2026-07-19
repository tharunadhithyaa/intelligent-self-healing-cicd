import { Response, NextFunction } from 'express';
import { complaintsService } from './complaints.service';
import { ApiResponse } from '../../utils/api-response.util';
import { AuthenticatedRequest } from '../../interfaces/request.interface';

class ComplaintsController {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const complaint = await complaintsService.submitComplaint(userId, req.body);
      ApiResponse.created(res, 'Complaint submitted successfully', { complaint });
    } catch (error) {
      next(error);
    }
  }

  async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const complaints = await complaintsService.getComplaintsByCitizen(userId);
      ApiResponse.success(res, 'Complaints fetched successfully', { complaints });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const complaintId = req.params['id'] as string;
      const complaint = await complaintsService.getComplaintById(userId, complaintId);
      ApiResponse.success(res, 'Complaint details fetched successfully', { complaint });
    } catch (error) {
      next(error);
    }
  }

  async analyzeDraft(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { title, description, location } = req.body;
      const analysis = await complaintsService.analyzeDraft(title, description, location);
      ApiResponse.success(res, 'AI Analysis draft generated successfully', { analysis });
    } catch (error) {
      next(error);
    }
  }
}

export const complaintsController = new ComplaintsController();
