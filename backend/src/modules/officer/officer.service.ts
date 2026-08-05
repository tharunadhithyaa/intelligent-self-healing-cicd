import mongoose, { Types } from "mongoose";
import Complaint, {
  IComplaintDocument,
  ComplaintStatus,
} from "../../models/complaint.model";
import Department from "../../models/department.model";
import User from "../../models/user.model";
import { ApiError } from "../../utils/api-error.util";
import { TokenPayload } from "../../utils/jwt.util";
import { WorkflowService } from "../complaints/workflow.service";
import { auditService } from "../admin/services/audit.service";

class OfficerService {
  private async getOfficerDepartment(
    officerId: string,
  ): Promise<string | null> {
    const dept = await Department.findOne({
      officers: Types.ObjectId.createFromHexString(officerId),
      status: "active",
    });
    return dept ? dept.name : null;
  }

  async getDashboardStats(user: TokenPayload): Promise<any> {
    const deptName = await this.getOfficerDepartment(user.userId);
    const officerId = Types.ObjectId.createFromHexString(user.userId);

    // 1. Assigned Complaints count
    const assignedCount = await Complaint.countDocuments({
      "assignment.officer": officerId,
      status: { $nin: ["resolved", "closed", "rejected"] },
    });

    let pendingCount = 0;
    let highPriorityCount = 0;
    let completedCount = 0;
    let deptQuery: Record<string, any> = {};

    if (deptName) {
      deptQuery["department"] = deptName;
      pendingCount = await Complaint.countDocuments({
        department: deptName,
        status: { $in: ["submitted", "verified"] },
      });
      highPriorityCount = await Complaint.countDocuments({
        department: deptName,
        "aiAnalysis.priority": { $in: ["high", "critical"] },
        status: { $nin: ["resolved", "closed", "rejected"] },
      });
      completedCount = await Complaint.countDocuments({
        department: deptName,
        status: { $in: ["resolved", "closed"] },
      });
    } else {
      // Fallback if not mapped to a department
      pendingCount = await Complaint.countDocuments({
        "assignment.officer": officerId,
        status: { $in: ["submitted", "verified"] },
      });
      highPriorityCount = await Complaint.countDocuments({
        "assignment.officer": officerId,
        "aiAnalysis.priority": { $in: ["high", "critical"] },
        status: { $nin: ["resolved", "closed", "rejected"] },
      });
      completedCount = await Complaint.countDocuments({
        "assignment.officer": officerId,
        status: { $in: ["resolved", "closed"] },
      });
    }

    return {
      assigned: assignedCount,
      pending: pendingCount,
      highPriority: highPriorityCount,
      completed: completedCount,
      averageResponseHours: 4.8, // Mocked performance metrics
    };
  }

  async getDepartmentStats(user: TokenPayload): Promise<any> {
    const deptName = await this.getOfficerDepartment(user.userId);
    if (!deptName) {
      return { total: 0, byStatus: {}, byPriority: {} };
    }

    const total = await Complaint.countDocuments({ department: deptName });
    const resolved = await Complaint.countDocuments({
      department: deptName,
      status: { $in: ["resolved", "closed"] },
    });
    const inProgress = await Complaint.countDocuments({
      department: deptName,
      status: "in_progress",
    });
    const waiting = await Complaint.countDocuments({
      department: deptName,
      status: "waiting",
    });
    const submitted = await Complaint.countDocuments({
      department: deptName,
      status: "submitted",
    });

    return {
      total,
      performanceRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
      workload: {
        submitted,
        inProgress,
        waiting,
        resolved,
      },
    };
  }

  async getComplaints(
    user: TokenPayload,
    params: Record<string, any>,
  ): Promise<any> {
    const deptName = await this.getOfficerDepartment(user.userId);
    const filter: Record<string, any> = {};

    // Scope to department or direct assignments
    if (deptName) {
      filter["department"] = deptName;
    } else {
      filter["assignment.officer"] = Types.ObjectId.createFromHexString(user.userId);
    }

    // Filters
    if (params["status"]) {
      filter["status"] = params["status"];
    }
    if (params["priority"]) {
      filter["aiAnalysis.priority"] = params["priority"];
    }
    if (params["assignedWorker"]) {
      filter["assignment.fieldWorker"] = Types.ObjectId.createFromHexString(
        params["assignedWorker"],
      );
    }

    // Search Query
    if (params["search"]) {
      const searchRegex = new RegExp(params["search"], "i");
      filter["$or"] = [{ title: searchRegex }, { description: searchRegex }];
      // Check if search is a valid ObjectId hex
      if (mongoose.Types.ObjectId.isValid(params["search"])) {
        filter["$or"].push({
          _id: Types.ObjectId.createFromHexString(params["search"]),
        });
      }
    }

    // Sorting
    let sortObj: Record<string, any> = { createdAt: -1 };
    if (params["sortBy"] === "priority") {
      sortObj = { "aiAnalysis.priority": -1 };
    } else if (params["sortBy"] === "status") {
      sortObj = { status: 1 };
    } else if (params["sortBy"] === "assignmentDate") {
      sortObj = { "assignment.assignedAt": -1 };
    }

    // Pagination
    const page = Math.max(1, Number.parseInt(params["page"]) || 1);
    const limit = Math.max(1, Number.parseInt(params["limit"]) || 10);
    const skip = (page - 1) * limit;

    const [complaints, total] = await Promise.all([
      Complaint.find(filter)
        .populate("citizen", "firstName lastName email phone")
        .populate("assignment.fieldWorker", "firstName lastName email")
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .exec(),
      Complaint.countDocuments(filter),
    ]);

    return {
      complaints,
      total,
      page,
      limit,
    };
  }

  async getComplaintDetails(
    user: TokenPayload,
    id: string,
  ): Promise<IComplaintDocument> {
    const deptName = await this.getOfficerDepartment(user.userId);
    const complaint = await Complaint.findById(id)
      .populate("citizen", "firstName lastName email phone")
      .populate("assignment.fieldWorker", "firstName lastName email")
      .exec();

    if (!complaint) {
      throw ApiError.notFound("Complaint record not found");
    }

    // Security verify: Officer must manage their assigned department or directly assigned issues
    if (deptName) {
      if (complaint.department !== deptName) {
        throw ApiError.forbidden(
          "You are not authorized to view complaints outside your department",
        );
      }
    } else if (complaint.assignment?.officer?.toString() !== user.userId) {
      throw ApiError.forbidden(
        "You are not authorized to view complaints not assigned to you",
      );
    }

    return complaint;
  }

  async transitionStatus(
    user: TokenPayload,
    id: string,
    nextStatus: ComplaintStatus,
    title: string,
    description: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<IComplaintDocument> {
    const complaint = await this.getComplaintDetails(user, id);
    const currentStatus = complaint.status;

    // Validate transition
    WorkflowService.validateTransition(currentStatus, nextStatus);

    complaint.status = nextStatus;
    complaint.timeline.push({
      status: nextStatus,
      title: title || `Status advanced to ${nextStatus}`,
      description: description || `Status updated by officer ${user.email}`,
      timestamp: new Date(),
      performedBy: Types.ObjectId.createFromHexString(user.userId),
    });

    const saved = await complaint.save();

    await auditService.log({
      actorId: user.userId,
      actorEmail: user.email,
      actorRole: user.role,
      action: "complaint_status_updated",
      target: "Complaint",
      targetId: id,
      details: { from: currentStatus, to: nextStatus, comment: title },
      ipAddress,
      userAgent,
    });

    return saved;
  }

  async assignWorker(
    user: TokenPayload,
    id: string,
    workerId: string,
    notes?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<IComplaintDocument> {
    const complaint = await this.getComplaintDetails(user, id);
    const wid = Types.ObjectId.createFromHexString(workerId);

    // Verify worker exists and is a field_worker
    const workerObj = await User.findOne({
      _id: wid,
      role: "field_worker",
      isActive: true,
    });
    if (!workerObj) {
      throw ApiError.badRequest("Invalid or inactive field worker selected");
    }

    const previousStatus = complaint.status;
    let nextStatus = previousStatus;

    // If submitted or verified, automatically update status to assigned
    if (
      previousStatus === "submitted" ||
      previousStatus === "verified" ||
      previousStatus === "ai_reviewed"
    ) {
      nextStatus = "assigned";
    }

    complaint.status = nextStatus;
    complaint.assignment = {
      officer: Types.ObjectId.createFromHexString(user.userId),
      fieldWorker: wid,
      assignedAt: new Date(),
      officerNotes: notes || complaint.assignment?.officerNotes,
      resolutionUpdates: complaint.assignment?.resolutionUpdates,
    };

    complaint.timeline.push({
      status: nextStatus,
      title: "Field Worker Assigned",
      description: `Assigned to ${workerObj.firstName} ${workerObj.lastName} by officer ${user.email}`,
      timestamp: new Date(),
      performedBy: Types.ObjectId.createFromHexString(user.userId),
    });

    const saved = await complaint.save();

    await auditService.log({
      actorId: user.userId,
      actorEmail: user.email,
      actorRole: user.role,
      action: "complaint_assigned_worker",
      target: "Complaint",
      targetId: id,
      details: { workerId, workerEmail: workerObj.email },
      ipAddress,
      userAgent,
    });

    return saved;
  }

  async addInternalNote(
    user: TokenPayload,
    id: string,
    text: string,
  ): Promise<IComplaintDocument> {
    const complaint = await this.getComplaintDetails(user, id);

    complaint.internalNotes.push({
      text,
      authorId: Types.ObjectId.createFromHexString(user.userId),
      authorName: `${user.email}`,
      timestamp: new Date(),
    });

    return await complaint.save();
  }

  async submitResolution(
    user: TokenPayload,
    id: string,
    description: string,
    details?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<IComplaintDocument> {
    const complaint = await this.getComplaintDetails(user, id);
    const currentStatus = complaint.status;

    // Validate transition
    WorkflowService.validateTransition(currentStatus, "resolved");

    complaint.status = "resolved";
    complaint.resolutionNotes = {
      description,
      completedAt: new Date(),
      details,
    };

    complaint.timeline.push({
      status: "resolved",
      title: "Resolution Recorded",
      description: `Incident marked as resolved. Summary: ${description}`,
      timestamp: new Date(),
      performedBy: Types.ObjectId.createFromHexString(user.userId),
    });

    const saved = await complaint.save();

    await auditService.log({
      actorId: user.userId,
      actorEmail: user.email,
      actorRole: user.role,
      action: "complaint_resolved_by_officer",
      target: "Complaint",
      targetId: id,
      details: { description },
      ipAddress,
      userAgent,
    });

    return saved;
  }

  async getAvailableWorkers(user: TokenPayload): Promise<any[]> {
    const deptName = await this.getOfficerDepartment(user.userId);

    if (deptName) {
      const deptObj = await Department.findOne({ name: deptName })
        .select("officers")
        .exec();
      if (deptObj && deptObj.officers.length > 0) {
        // Query users in the department roster with field_worker role
        return await User.find({
          _id: { $in: deptObj.officers },
          role: "field_worker",
          isActive: true,
        })
          .select("_id firstName lastName email phone")
          .exec();
      }
    }

    // Fallback: Query all active field workers in system
    return await User.find({ role: "field_worker", isActive: true })
      .select("_id firstName lastName email phone")
      .exec();
  }
}

export const officerService = new OfficerService();
