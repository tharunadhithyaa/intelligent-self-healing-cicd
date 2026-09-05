import mongoose from "mongoose";
import Department, {
  IDepartmentDocument,
} from "../../../models/department.model";
import User from "../../../models/user.model";
import Complaint from "../../../models/complaint.model";
import { ApiError } from "../../../utils/api-error.util";
import { TokenPayload } from "../../../utils/jwt.util";
import { apiCache } from "../../../utils/cache.util";
import { auditService } from "./audit.service";

class DepartmentService {
  async createDepartment(
    admin: TokenPayload,
    name: string,
    description: string,
    contactInfo: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<IDepartmentDocument> {
    const exists = await Department.findOne({ name });
    if (exists) {
      throw ApiError.conflict("A department with this name already exists");
    }

    const dept = new Department({
      name,
      description,
      contactInfo,
      status: "active",
      officers: [],
      assignmentHistory: [],
    });

    const saved = await dept.save();

    await auditService.log({
      actorId: admin.userId,
      actorEmail: admin.email,
      actorRole: admin.role,
      action: "department_created",
      target: "Department",
      targetId: saved._id.toString(),
      details: { name },
      ipAddress,
      userAgent,
    });

    apiCache.delete("departments");
    return saved;
  }

  async getDepartments(): Promise<IDepartmentDocument[]> {
    const cached = apiCache.get<IDepartmentDocument[]>("departments");
    if (cached) {
      return cached;
    }
    const departments = await Department.find()
      .populate("officers", "firstName lastName email role")
      .exec();
    apiCache.set("departments", departments, 5 * 60 * 1000); // 5 minutes cache TTL
    return departments;
  }

  async updateDepartment(
    admin: TokenPayload,
    deptId: string,
    data: {
      name: string;
      description: string;
      contactInfo: string;
      status: "active" | "inactive";
    },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<IDepartmentDocument> {
    const dept = await Department.findById(deptId);
    if (!dept) {
      throw ApiError.notFound("Department not found");
    }

    // Check conflict if name changed
    if (data.name !== dept.name) {
      const exists = await Department.findOne({ name: data.name });
      if (exists) {
        throw ApiError.conflict("A department with this name already exists");
      }
    }

    dept.name = data.name;
    dept.description = data.description;
    dept.contactInfo = data.contactInfo;
    dept.status = data.status;

    const saved = await dept.save();

    await auditService.log({
      actorId: admin.userId,
      actorEmail: admin.email,
      actorRole: admin.role,
      action: "department_updated",
      target: "Department",
      targetId: deptId,
      details: { name: data.name },
      ipAddress,
      userAgent,
    });

    apiCache.delete("departments");
    return saved;
  }

  async deleteDepartment(
    admin: TokenPayload,
    deptId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const dept = await Department.findById(deptId);
    if (!dept) {
      throw ApiError.notFound("Department not found");
    }

    // Check if there are active complaints assigned to this department
    const activeComplaints = await Complaint.countDocuments({
      department: dept.name,
      status: { $ne: "closed" },
    });

    if (activeComplaints > 0) {
      throw ApiError.badRequest(
        `Cannot delete department: There are ${activeComplaints} active complaints currently assigned to this department. Please reassign them first.`,
      );
    }

    // Delete
    await Department.findByIdAndDelete(deptId);
    apiCache.delete("departments");

    await auditService.log({
      actorId: admin.userId,
      actorEmail: admin.email,
      actorRole: admin.role,
      action: "department_deleted",
      target: "Department",
      targetId: deptId,
      details: { name: dept.name },
      ipAddress,
      userAgent,
    });
  }

  async assignOfficer(
    admin: TokenPayload,
    deptId: string,
    officerId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<IDepartmentDocument> {
    const [dept, officer] = await Promise.all([
      Department.findById(deptId),
      User.findById(officerId),
    ]);

    if (!dept) {
      throw ApiError.notFound("Department not found");
    }
    if (!officer) {
      throw ApiError.notFound("Officer user not found");
    }
    if (officer.role !== "officer" && officer.role !== "field_worker") {
      throw ApiError.badRequest(
        "Only municipal officers or field workers can be assigned to departments",
      );
    }

    const oid = new mongoose.Types.ObjectId(officerId);

    // Check if already assigned to this department
    if (dept.officers.includes(oid)) {
      return dept;
    }

    // Assign
    dept.officers.push(oid);
    dept.assignmentHistory.push({
      officerId: oid,
      action: "assigned",
      timestamp: new Date(),
    });

    const saved = await dept.save();

    await auditService.log({
      actorId: admin.userId,
      actorEmail: admin.email,
      actorRole: admin.role,
      action: "officer_assigned_to_department",
      target: "Department",
      targetId: deptId,
      details: { officerEmail: officer.email, officerId },
      ipAddress,
      userAgent,
    });

    apiCache.delete("departments");
    return saved;
  }

  async removeOfficer(
    admin: TokenPayload,
    deptId: string,
    officerId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<IDepartmentDocument> {
    const dept = await Department.findById(deptId);
    if (!dept) {
      throw ApiError.notFound("Department not found");
    }

    const oid = new mongoose.Types.ObjectId(officerId);
    const index = dept.officers.indexOf(oid);

    if (index === -1) {
      return dept;
    }

    // Remove
    dept.officers.splice(index, 1);
    dept.assignmentHistory.push({
      officerId: oid,
      action: "removed",
      timestamp: new Date(),
    });

    const saved = await dept.save();

    const officer = await User.findById(officerId);
    await auditService.log({
      actorId: admin.userId,
      actorEmail: admin.email,
      actorRole: admin.role,
      action: "officer_removed_from_department",
      target: "Department",
      targetId: deptId,
      details: { officerEmail: officer?.email, officerId },
      ipAddress,
      userAgent,
    });

    apiCache.delete("departments");
    return saved;
  }
}

export const departmentService = new DepartmentService();
