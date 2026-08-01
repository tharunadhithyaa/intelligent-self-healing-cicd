import { Response, NextFunction } from "express";
import { citizenService } from "./citizen.service";
import { ApiResponse } from "../../utils/api-response.util";
import { AuthenticatedRequest } from "../../interfaces/request.interface";

class CitizenController {
  async updateProfile(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const user = await citizenService.updateProfile(userId, req.body);
      ApiResponse.success(res, "Profile updated successfully", { user });
    } catch (error) {
      next(error);
    }
  }

  async changePassword(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { currentPassword, newPassword } = req.body;
      await citizenService.changePassword(userId, currentPassword, newPassword);
      ApiResponse.success(res, "Password changed successfully");
    } catch (error) {
      next(error);
    }
  }

  async getSettings(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const settings = await citizenService.getSettings(userId);
      ApiResponse.success(res, "Settings fetched successfully", { settings });
    } catch (error) {
      next(error);
    }
  }

  async updateSettings(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const user = await citizenService.updateSettings(userId, req.body);
      ApiResponse.success(res, "Settings updated successfully", { user });
    } catch (error) {
      next(error);
    }
  }

  async downloadData(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const data = await citizenService.downloadData(userId);
      // Return as JSON file
      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="civicpulse_data_${userId}.json"`,
      );
      res.send(JSON.stringify(data, null, 2));
    } catch (error) {
      next(error);
    }
  }
}

export const citizenController = new CitizenController();
