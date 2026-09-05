import { Response, NextFunction } from "express";
import { officerService } from "./officer.service";
import { ApiResponse } from "../../utils/api-response.util";
import { AuthenticatedRequest } from "../../interfaces/request.interface";

class OfficerController {
  async getDashboardStats(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const stats = await officerService.getDashboardStats(req.user!);
      ApiResponse.success(res, "Dashboard statistics fetched successfully", {
        stats,
      });
    } catch (error) {
      next(error);
    }
  }

  async getDepartmentStats(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const stats = await officerService.getDepartmentStats(req.user!);
      ApiResponse.success(res, "Department statistics fetched successfully", {
        stats,
      });
    } catch (error) {
      next(error);
    }
  }

  async getComplaints(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const result = await officerService.getComplaints(req.user!, req.query);
      ApiResponse.success(
        res,
        "Complaints list retrieved successfully",
        result,
      );
    } catch (error) {
      next(error);
    }
  }

  async getComplaintDetails(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const id = req.params["id"] as string;
      const complaint = await officerService.getComplaintDetails(req.user!, id);
      ApiResponse.success(res, "Complaint details retrieved successfully", {
        complaint,
      });
    } catch (error) {
      next(error);
    }
  }

  async transitionStatus(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const id = req.params["id"] as string;
      const { status, title, description } = req.body;
      const ipAddress = req.ip;
      const userAgent = req.headers["user-agent"];

      const complaint = await officerService.transitionStatus(
        req.user!,
        id,
        status,
        title,
        description,
        ipAddress,
        userAgent,
      );
      ApiResponse.success(res, "Complaint status updated successfully", {
        complaint,
      });
    } catch (error) {
      next(error);
    }
  }

  async assignWorker(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const id = req.params["id"] as string;
      const { workerId, notes } = req.body;
      const ipAddress = req.ip;
      const userAgent = req.headers["user-agent"];

      const complaint = await officerService.assignWorker(
        req.user!,
        id,
        workerId,
        notes,
        ipAddress,
        userAgent,
      );
      ApiResponse.success(res, "Field worker assigned successfully", {
        complaint,
      });
    } catch (error) {
      next(error);
    }
  }

  async addInternalNote(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const id = req.params["id"] as string;
      const { text } = req.body;

      const complaint = await officerService.addInternalNote(
        req.user!,
        id,
        text,
      );
      ApiResponse.success(res, "Internal note added successfully", {
        complaint,
      });
    } catch (error) {
      next(error);
    }
  }

  async submitResolution(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const id = req.params["id"] as string;
      const { description, details } = req.body;
      const ipAddress = req.ip;
      const userAgent = req.headers["user-agent"];

      const complaint = await officerService.submitResolution(
        req.user!,
        id,
        description,
        details,
        ipAddress,
        userAgent,
      );
      ApiResponse.success(res, "Complaint marked as resolved successfully", {
        complaint,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAvailableWorkers(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const workers = await officerService.getAvailableWorkers(req.user!);
      ApiResponse.success(res, "Available field workers list retrieved", {
        workers,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const officerController = new OfficerController();
