import mongoose from "mongoose";
import Conversation, {
  IConversationDocument,
} from "../../models/conversation.model";
import Complaint from "../../models/complaint.model";
import Department from "../../models/department.model";
import { ApiError } from "../../utils/api-error.util";
import { TokenPayload } from "../../utils/jwt.util";

interface PopulatedCitizen {
  firstName?: string;
  lastName?: string;
  email?: string;
}

class AIChatService {
  async getConversations(userId: string): Promise<IConversationDocument[]> {
    return await Conversation.find({
      userId: new mongoose.Types.ObjectId(userId),
    })
      .sort({ updatedAt: -1 })
      .exec();
  }

  async getConversationById(
    userId: string,
    conversationId: string,
  ): Promise<IConversationDocument> {
    const conv = await Conversation.findOne({
      _id: new mongoose.Types.ObjectId(conversationId),
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!conv) {
      throw ApiError.notFound("Conversation session not found");
    }

    return conv;
  }

  async deleteAllConversations(userId: string): Promise<void> {
    await Conversation.deleteMany({
      userId: new mongoose.Types.ObjectId(userId),
    });
  }

  async sendMessage(
    user: TokenPayload,
    conversationId: string | undefined,
    messageText: string,
  ): Promise<{ conversation: IConversationDocument; reply: string }> {
    let conv: IConversationDocument | null = null;
    const uid = new mongoose.Types.ObjectId(user.userId);

    if (conversationId) {
      conv = await Conversation.findOne({
        _id: new mongoose.Types.ObjectId(conversationId),
        userId: uid,
      });
      if (!conv) {
        throw ApiError.notFound("Conversation session not found");
      }
    } else {
      conv = new Conversation({
        userId: uid,
        role: user.role,
        messages: [],
      });
    }

    // 1. Add User Message
    conv.messages.push({
      sender: "user",
      text: messageText,
      timestamp: new Date(),
    });

    // 2. Build AI Assistant Response based on role and text context
    const reply = await this.generateAIResponse(
      user,
      messageText,
      conv.messages,
    );

    // 3. Add Bot Message
    conv.messages.push({
      sender: "bot",
      text: reply,
      timestamp: new Date(),
    });

    const saved = await conv.save();

    return {
      conversation: saved,
      reply,
    };
  }

  private async generateAIResponse(
    user: TokenPayload,
    text: string,
    _history: Array<{ sender: "user" | "bot"; text: string }>,
  ): Promise<string> {
    const cleanText = text.toLowerCase().trim();

    if (user.role === "citizen") {
      return this.handleCitizenAIResponse(user, cleanText);
    }

    if (user.role === "officer" || user.role === "admin") {
      return this.handleStaffAIResponse(user, cleanText);
    }

    return this.getDefaultAIResponse();
  }

  // ─── Citizen Flow ───
  private async handleCitizenAIResponse(
    user: TokenPayload,
    cleanText: string,
  ): Promise<string> {
    if (this.isSubmitRequest(cleanText)) {
      return this.getSubmitGuidance();
    }

    if (this.isStatusRequest(cleanText)) {
      return this.getCitizenComplaintStatus(user);
    }

    const ticketId = this.extractTicketId(cleanText);
    if (ticketId) {
      return this.getCitizenComplaintDetails(user, ticketId);
    }

    if (this.isDepartmentRequest(cleanText)) {
      return this.getDepartmentProfiles();
    }

    return this.getCitizenDefaultResponse();
  }

  private isSubmitRequest(text: string): boolean {
    return (
      text.includes("submit") ||
      text.includes("report") ||
      text.includes("create issue")
    );
  }

  private isStatusRequest(text: string): boolean {
    return (
      text.includes("status") ||
      text.includes("my complaint") ||
      text.includes("my tickets") ||
      text.includes("track")
    );
  }

  private isDepartmentRequest(text: string): boolean {
    return (
      text.includes("department") ||
      text.includes("agency") ||
      text.includes("who handles")
    );
  }

  private getSubmitGuidance(): string {
    return `To submit a new complaint, navigate to the **Report Issue** tab in the sidebar. The system runs a 4-step wizard:
1. **Issue Info**: Enter your title, description, category, and address.
2. **AI Copilot**: Inspect predicted category, suggested department, and potential duplicates. You can override suggestions if necessary.
3. **Media Upload**: Attach up to 3 photos (maximum 2MB per image, JPG/PNG formats).
4. **Final Confirmation**: Review all fields and submit your ticket. Let me know if you need help explaining categories!`;
  }

  private async getCitizenComplaintStatus(user: TokenPayload): Promise<string> {
    const list = await Complaint.find({
      citizen: new mongoose.Types.ObjectId(user.userId),
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .exec();

    if (list.length === 0) {
      return "You haven't submitted any incident tickets in CivicPulse yet. Would you like instructions on how to submit a new complaint?";
    }

    const items = list
      .map(
        (c) =>
          `• **${c.title}** (Category: *${c.category}*, Status: **${c.status.toUpperCase()}**) - ID: \`${c._id}\``,
      )
      .join("\n");

    return `Here are your recent submitted incidents:
${items}

To get details or explain resolution progress for a specific ticket, please ask me about its ID or paste the ID directly!`;
  }

  private async getCitizenComplaintDetails(
    user: TokenPayload,
    ticketId: string,
  ): Promise<string> {
    const ticket = await Complaint.findOne({
      _id: new mongoose.Types.ObjectId(ticketId),
      citizen: new mongoose.Types.ObjectId(user.userId),
    });

    if (!ticket) {
      return "I couldn't find a complaint matching that ID in your account record. Please make sure the ID is correct and belongs to you.";
    }

    const lastTimeline = ticket.timeline.at(-1);
    const priority = ticket.aiAnalysis?.priority?.toUpperCase() ?? "MEDIUM";
    const department = ticket.department || "Not Assigned Yet";
    const statusUpper = ticket.status.toUpperCase();
    const actionDesc = lastTimeline?.description ?? "Submitted";
    const actionDate = lastTimeline
      ? new Date(lastTimeline.timestamp).toLocaleDateString()
      : "N/A";

    return `**Incident Details: "${ticket.title}"**
• **Category**: ${ticket.category}
• **Priority Severity**: ${priority}
• **Assigned Department**: ${department}
• **Current Status**: **${statusUpper}**
• **Latest Action**: ${actionDesc} on ${actionDate}

*Resolution Progress*: The ticket is currently in the **${ticket.status}** stage. Officers will verify coordinates and reallocate to field crews for repairs. Let me know if you need to know about assigned departments!`;
  }

  private async getDepartmentProfiles(): Promise<string> {
    const depts = await Department.find({ status: "active" })
      .select("name contactInfo")
      .exec();

    const listStr = depts
      .map((d) => `• **${d.name}** (Contact: *${d.contactInfo}*)`)
      .join("\n");

    return `Here are our active municipal support agencies:
${listStr}

Our backend AI Classifier automatically routes your complaints to the correct department based on keywords in your description.`;
  }

  private getCitizenDefaultResponse(): string {
    return "Hello! I am your CivicPulse AI assistant chatbot. I can guide you through **submitting new complaints**, **tracking ticket status**, looking up **department contact sheets**, or answering general municipal questions. Try typing 'my complaints' or 'how do I report an issue'!";
  }

  // ─── Staff Flow ───
  private async handleStaffAIResponse(
    user: TokenPayload,
    cleanText: string,
  ): Promise<string> {
    const ticketId = this.extractTicketId(cleanText);
    if (ticketId) {
      return this.getStaffComplaintDetails(ticketId);
    }

    if (
      user.role === "admin" &&
      (cleanText.includes("analytics") ||
        cleanText.includes("stats") ||
        cleanText.includes("system info"))
    ) {
      return this.getAdminAnalyticsGuide();
    }

    return this.getStaffDefaultResponse(user.role);
  }

  private async getStaffComplaintDetails(ticketId: string): Promise<string> {
    const ticket = await Complaint.findById(ticketId).populate(
      "citizen",
      "firstName lastName email",
    );

    if (!ticket) {
      return "I couldn't find a system complaint matching that ID. Please check the hex identifier.";
    }

    const lastTimeline = ticket.timeline.at(-1);
    const submitterInfo = this.formatCitizenInfo(ticket.citizen);
    const priority = ticket.aiAnalysis?.priority?.toUpperCase() ?? "MEDIUM";
    const department = ticket.department || "None";
    const confidence = ticket.aiAnalysis?.confidenceScore ?? 0;
    const lastUpdate = lastTimeline?.description ?? "N/A";

    return `**[INTERNAL RETAIL SHEET] ID: ${ticket._id}**
• **Title**: "${ticket.title}"
• **Submitter**: ${submitterInfo}
• **Status**: **${ticket.status.toUpperCase()}** (Priority: *${priority}*)
• **Assigned Agency**: ${department}
• **AI Classification Confidence**: ${confidence}%

**Suggested Actions**:
- If status is *submitted*, review coordinates and reassign/dispatch.
- If status is *assigned*, allocate to an active field worker.
- Current timeline last updated: ${lastUpdate}`;
  }

  private formatCitizenInfo(citizen: unknown): string {
    if (!citizen || typeof citizen !== "object") {
      return "Citizen (N/A)";
    }
    const c = citizen as PopulatedCitizen;
    const name =
      [c.firstName, c.lastName].filter(Boolean).join(" ") || "Citizen";
    const email = c.email || "N/A";
    return `${name} (${email})`;
  }

  private getAdminAnalyticsGuide(): string {
    return `**CivicPulse Administration Dashboard Diagnostics Guide**:
• **Overview Cards**: Tracks total Citizens, incident counts, pending audit files, active workloads, and resolved cases.
• **Monthly Complaint Trends**: SVG line chart tracking ticket creation vs resolution rates over the past 6 months.
• **AI Diagnostics**: Gauge charts highlighting predicted category precision, severity weights, and duplicate detection performance (baseline 92%).
• **Heatmap Coordinates**: Density plot highlighting localized ticket concentrations ready for GIS integration.
• **System Ledger**: Ledger tracking security locks, deactivations, and reassignments.

Let me know if you want to inspect a specific ticket by pasting its ID!`;
  }

  private getStaffDefaultResponse(role: string): string {
    const roleTitle = role === "admin" ? "Administrator" : "Officer";
    return `Welcome, ${roleTitle}! I am the internal control AI assistant. I can:
1. Provide summaries and suggested workflow steps for any incident ticket (paste the 24-character hex ID).
2. Look up related complaints coordinates.
3. Guide you through dashboard analytics and control panels.

What can I assist you with today?`;
  }

  private getDefaultAIResponse(): string {
    return "Hello! I am your CivicPulse AI assistant. How can I assist you today?";
  }

  private extractTicketId(text: string): string | null {
    const match = /[0-9a-f]{24}/i.exec(text);
    return match ? match[0] : null;
  }
}

export const aiChatService = new AIChatService();
