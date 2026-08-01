import mongoose from "mongoose";
import Complaint, {
  IComplaintDocument,
  ComplaintCategory,
  IComplaintImage,
} from "../../models/complaint.model";
import { aiService } from "./ai.service";
import { ApiError } from "../../utils/api-error.util";

export interface CreateComplaintInput {
  title: string;
  description: string;
  category: ComplaintCategory;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  images: Array<{
    base64Data: string;
    contentType: string;
    fileName: string;
  }>;
}

class ComplaintsService {
  async submitComplaint(
    userId: string,
    input: CreateComplaintInput,
  ): Promise<IComplaintDocument> {
    // 1. Run AI analysis
    const aiResult = await aiService.analyzeComplaint(
      input.title,
      input.description,
      input.location,
    );

    // 2. Map images
    const images: IComplaintImage[] = input.images.map((img) => ({
      base64Data: img.base64Data,
      contentType: img.contentType,
      fileName: img.fileName,
    }));

    // 3. Build timelines
    const now = new Date();
    const timeline = [
      {
        status: "submitted" as const,
        title: "Complaint Submitted",
        description:
          "Your complaint has been successfully recorded in the system.",
        timestamp: now,
        performedBy: new mongoose.Types.ObjectId(userId),
      },
      {
        status: "ai_reviewed" as const,
        title: "AI Analysis Completed",
        description: `Automated assessment categorized this under "${aiResult.category}" with a predicted "${aiResult.priority}" priority. Recommended department: ${aiResult.department}.`,
        timestamp: new Date(now.getTime() + 1000), // offset by 1s for order
        performedBy: new mongoose.Types.ObjectId(userId),
      },
    ];

    // 4. Create Complaint
    const complaint = new Complaint({
      citizen: new mongoose.Types.ObjectId(userId),
      title: input.title,
      description: input.description,
      category: input.category,
      location: input.location,
      department: aiResult.department,
      status: "ai_reviewed", // Auto transitioned after AI review
      aiAnalysis: aiResult,
      images,
      timeline,
      date: now,
    });

    return await complaint.save();
  }

  async getComplaintsByCitizen(userId: string): Promise<IComplaintDocument[]> {
    return await Complaint.find({
      citizen: new mongoose.Types.ObjectId(userId),
    })
      .sort({ createdAt: -1 })
      .select("-images.base64Data"); // Exclude large image binaries from list payloads for optimal loading speeds
  }

  async getComplaintById(
    userId: string,
    complaintId: string,
  ): Promise<IComplaintDocument> {
    if (!mongoose.Types.ObjectId.isValid(complaintId)) {
      throw ApiError.badRequest("Invalid complaint ID format");
    }

    const complaint = await Complaint.findOne({
      _id: new mongoose.Types.ObjectId(complaintId),
      citizen: new mongoose.Types.ObjectId(userId),
    });

    if (!complaint) {
      throw ApiError.notFound("Complaint not found");
    }

    return complaint;
  }

  async analyzeDraft(
    title: string,
    description: string,
    location: { latitude: number; longitude: number; address: string },
  ) {
    return await aiService.analyzeComplaint(title, description, location);
  }
}

export const complaintsService = new ComplaintsService();
