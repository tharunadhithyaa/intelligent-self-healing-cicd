import { Response, NextFunction } from "express";
import { fieldWorkerService } from "./field-worker.service";
import { ApiResponse } from "../../utils/api-response.util";
import { AuthenticatedRequest } from "../../interfaces/request.interface";

class FieldWorkerController {
  async getAssignedJobs(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const result = await fieldWorkerService.getAssignedJobs(
        req.user!,
        req.query,
      );
      ApiResponse.success(res, "Assigned tasks retrieved successfully", result);
    } catch (error) {
      next(error);
    }
  }

  async getJobDetails(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const id = req.params["id"] as string;
      const job = await fieldWorkerService.getJobDetails(req.user!, id);
      ApiResponse.success(res, "Task details retrieved successfully", { job });
    } catch (error) {
      next(error);
    }
  }

  async updateJobStatus(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const id = req.params["id"] as string;
      const { status, notes } = req.body;
      const ipAddress = req.ip;
      const userAgent = req.headers["user-agent"];

      const job = await fieldWorkerService.updateJobStatus(
        req.user!,
        id,
        status,
        notes,
        ipAddress,
        userAgent,
      );
      ApiResponse.success(res, "Task status updated successfully", { job });
    } catch (error) {
      next(error);
    }
  }

  async uploadPhotos(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const id = req.params["id"] as string;
      const { photoType, images } = req.body;

      const job = await fieldWorkerService.uploadPhotos(
        req.user!,
        id,
        photoType,
        images,
      );
      ApiResponse.success(res, "Photos uploaded successfully", { job });
    } catch (error) {
      next(error);
    }
  }
}

export const fieldWorkerController = new FieldWorkerController();
