import mongoose from "mongoose";
import Complaint, {
  IComplaintDocument,
  ComplaintStatus,
  IComplaintImage,
} from "../../models/complaint.model";
import { ApiError } from "../../utils/api-error.util";
import { TokenPayload } from "../../utils/jwt.util";
import { WorkflowService } from "../complaints/workflow.service";
import { auditService } from "../admin/services/audit.service";

class FieldWorkerService {
  async getAssignedJobs(
    user: TokenPayload,
    params: Record<string, any>,
  ): Promise<any> {
    const workerId = new mongoose.Types.ObjectId(user.userId);
    const filter: Record<string, any> = {
      "assignment.fieldWorker": workerId,
    };

    if (params["status"]) {
      filter["status"] = params["status"];
    }

    if (params["search"]) {
      const searchRegex = new RegExp(params["search"], "i");
      filter["$or"] = [{ title: searchRegex }, { description: searchRegex }];
    }

    const page = Math.max(1, Number.parseInt(params["page"]) || 1);
    const limit = Math.max(1, Number.parseInt(params["limit"]) || 10);
    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      Complaint.find(filter)
        .populate("citizen", "firstName lastName email phone")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      Complaint.countDocuments(filter),
    ]);

    return {
      jobs,
      total,
      page,
      limit,
    };
  }

  async getJobDetails(
    user: TokenPayload,
    id: string,
  ): Promise<IComplaintDocument> {
    const complaint = await Complaint.findById(id)
      .populate("citizen", "firstName lastName email phone")
      .exec();

    if (!complaint) {
      throw ApiError.notFound("Complaint record not found");
    }

    // Security verify: Field Worker can only access tasks assigned to them
    if (complaint.assignment?.fieldWorker?.toString() !== user.userId) {
      throw ApiError.forbidden(
        "You are not authorized to view this assignment",
      );
    }

    return complaint;
  }

  async updateJobStatus(
    user: TokenPayload,
    id: string,
    nextStatus: ComplaintStatus,
    notes?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<IComplaintDocument> {
    const complaint = await this.getJobDetails(user, id);
    const currentStatus = complaint.status;

    // Validate transition
    WorkflowService.validateTransition(currentStatus, nextStatus);

    complaint.status = nextStatus;
    complaint.timeline.push({
      status: nextStatus,
      title: `Progress Update: ${nextStatus.toUpperCase()}`,
      description: notes || `Updated by assigned field worker`,
      timestamp: new Date(),
      performedBy: new mongoose.Types.ObjectId(user.userId),
    });

    // If transitioned to resolved, fill default resolution notes
    if (nextStatus === "resolved") {
      complaint.resolutionNotes = {
        description: notes || "Resolved by field worker",
        completedAt: new Date(),
        details: "Submitted from field device",
      };
    }

    const saved = await complaint.save();

    await auditService.log({
      actorId: user.userId,
      actorEmail: user.email,
      actorRole: user.role,
      action: "field_worker_status_updated",
      target: "Complaint",
      targetId: id,
      details: { from: currentStatus, to: nextStatus, comments: notes },
      ipAddress,
      userAgent,
    });

    return saved;
  }

  async uploadPhotos(
    user: TokenPayload,
    id: string,
    photoType: "before" | "after",
    images: IComplaintImage[],
  ): Promise<IComplaintDocument> {
    const complaint = await this.getJobDetails(user, id);

    if (photoType === "before") {
      complaint.beforeImages.push(...images);
    } else {
      complaint.afterImages.push(...images);
    }

    complaint.timeline.push({
      status: complaint.status,
      title: `Attachment uploaded`,
      description: `Uploaded ${images.length} ${photoType} photo(s) references`,
      timestamp: new Date(),
      performedBy: new mongoose.Types.ObjectId(user.userId),
    });

    return await complaint.save();
  }
}

export const fieldWorkerService = new FieldWorkerService();
