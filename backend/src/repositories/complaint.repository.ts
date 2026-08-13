import { BaseRepository } from "./base.repository";
import Complaint, { IComplaintDocument } from "../models/complaint.model";

export class ComplaintRepository extends BaseRepository<IComplaintDocument> {
  constructor() {
    super(Complaint);
  }

  // Include pagination and details helper
  async findPaginated(
    filter: Record<string, any>,
    sort: Record<string, any>,
    skip: number,
    limit: number,
  ): Promise<IComplaintDocument[]> {
    return this.model
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select("-images.base64Data") // Exclude heavy base64 data for listing
      .populate("citizen", "firstName lastName email")
      .populate("assignment.officer", "firstName lastName email")
      .exec();
  }

  async findByCitizenId(citizenId: string): Promise<IComplaintDocument[]> {
    return this.model.find({ citizen: citizenId }).exec();
  }

  async updateStatus(id: string, status: any): Promise<IComplaintDocument | null> {
    return this.model.findByIdAndUpdate(id, { status }, { new: true }).exec();
  }

  async assignOfficer(id: string, officerId: string, departmentId?: string): Promise<IComplaintDocument | null> {
    return this.model.findByIdAndUpdate(
      id,
      { "assignment.officer": officerId, "assignment.department": departmentId, status: "assigned" },
      { new: true }
    ).exec();
  }
}

export const complaintRepository = new ComplaintRepository();
