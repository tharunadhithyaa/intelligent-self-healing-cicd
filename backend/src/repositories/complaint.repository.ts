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
}

export const complaintRepository = new ComplaintRepository();
