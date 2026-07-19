import mongoose from 'mongoose';
import Conversation, { IConversationDocument } from '../../models/conversation.model';
import Complaint from '../../models/complaint.model';
import Department from '../../models/department.model';
import { ApiError } from '../../utils/api-error.util';
import { TokenPayload } from '../../utils/jwt.util';

class AIChatService {
  async getConversations(userId: string): Promise<IConversationDocument[]> {
    return await Conversation.find({ userId: new mongoose.Types.ObjectId(userId) })
      .sort({ updatedAt: -1 })
      .exec();
  }

  async getConversationById(userId: string, conversationId: string): Promise<IConversationDocument> {
    const conv = await Conversation.findOne({
      _id: new mongoose.Types.ObjectId(conversationId),
      userId: new mongoose.Types.ObjectId(userId)
    });

    if (!conv) {
      throw ApiError.notFound('Conversation session not found');
    }

    return conv;
  }

  async deleteAllConversations(userId: string): Promise<void> {
    await Conversation.deleteMany({ userId: new mongoose.Types.ObjectId(userId) });
  }

  async sendMessage(
    user: TokenPayload,
    conversationId: string | undefined,
    messageText: string
  ): Promise<{ conversation: IConversationDocument; reply: string }> {
    let conv: IConversationDocument | null = null;
    const uid = new mongoose.Types.ObjectId(user.userId);

    if (conversationId) {
      conv = await Conversation.findOne({ _id: new mongoose.Types.ObjectId(conversationId), userId: uid });
      if (!conv) {
        throw ApiError.notFound('Conversation session not found');
      }
    } else {
      conv = new Conversation({
        userId: uid,
        role: user.role,
        messages: []
      });
    }

    // 1. Add User Message
    conv.messages.push({
      sender: 'user',
      text: messageText,
      timestamp: new Date()
    });

    // 2. Build AI Assistant Response based on role and text context
    const reply = await this.generateAIResponse(user, messageText, conv.messages);

    // 3. Add Bot Message
    conv.messages.push({
      sender: 'bot',
      text: reply,
      timestamp: new Date()
    });

    const saved = await conv.save();

    return {
      conversation: saved,
      reply
    };
  }

  private async generateAIResponse(
    user: TokenPayload,
    text: string,
    _history: Array<{ sender: 'user' | 'bot'; text: string }>
  ): Promise<string> {
    const cleanText = text.toLowerCase().trim();

    // ─── Citizen Assistance Flow ───
    if (user.role === 'citizen') {
      // 1. Submit guidance
      if (cleanText.includes('submit') || cleanText.includes('report') || cleanText.includes('create issue')) {
        return `To submit a new complaint, navigate to the **Report Issue** tab in the sidebar. The system runs a 4-step wizard:
1. **Issue Info**: Enter your title, description, category, and address.
2. **AI Copilot**: Inspect predicted category, suggested department, and potential duplicates. You can override suggestions if necessary.
3. **Media Upload**: Attach up to 3 photos (maximum 2MB per image, JPG/PNG formats).
4. **Final Confirmation**: Review all fields and submit your ticket. Let me know if you need help explaining categories!`;
      }

      // 2. Check status of complaints
      if (cleanText.includes('status') || cleanText.includes('my complaint') || cleanText.includes('my tickets') || cleanText.includes('track')) {
        // Look up citizen complaints
        const list = await Complaint.find({ citizen: new mongoose.Types.ObjectId(user.userId) })
          .sort({ createdAt: -1 })
          .limit(5)
          .exec();

        if (list.length === 0) {
          return "You haven't submitted any incident tickets in CivicPulse yet. Would you like instructions on how to submit a new complaint?";
        }

        const items = list.map(c => `• **${c.title}** (Category: *${c.category}*, Status: **${c.status.toUpperCase()}**) - ID: \`${c._id}\``).join('\n');
        return `Here are your recent submitted incidents:
${items}

To get details or explain resolution progress for a specific ticket, please ask me about its ID or paste the ID directly!`;
      }

      // 3. Specific Complaint ID lookup
      const idMatch = cleanText.match(/[0-9a-f]{24}/i);
      if (idMatch) {
        const ticketId = idMatch[0];
        const ticket = await Complaint.findOne({
          _id: new mongoose.Types.ObjectId(ticketId),
          citizen: new mongoose.Types.ObjectId(user.userId)
        });

        if (!ticket) {
          return "I couldn't find a complaint matching that ID in your account record. Please make sure the ID is correct and belongs to you.";
        }

        const lastTimeline = ticket.timeline[ticket.timeline.length - 1];
        return `**Incident Details: "${ticket.title}"**
• **Category**: ${ticket.category}
• **Priority Severity**: ${ticket.aiAnalysis ? ticket.aiAnalysis.priority.toUpperCase() : 'MEDIUM'}
• **Assigned Department**: ${ticket.department || 'Not Assigned Yet'}
• **Current Status**: **${ticket.status.toUpperCase()}**
• **Latest Action**: ${lastTimeline ? lastTimeline.description : 'Submitted'} on ${lastTimeline ? new Date(lastTimeline.timestamp).toLocaleDateString() : 'N/A'}

*Resolution Progress*: The ticket is currently in the **${ticket.status}** stage. Officers will verify coordinates and reallocate to field crews for repairs. Let me know if you need to know about assigned departments!`;
      }

      // 4. Department Profiles
      if (cleanText.includes('department') || cleanText.includes('agency') || cleanText.includes('who handles')) {
        const depts = await Department.find({ status: 'active' }).select('name contactInfo').exec();
        const listStr = depts.map(d => `• **${d.name}** (Contact: *${d.contactInfo}*)`).join('\n');
        return `Here are our active municipal support agencies:
${listStr}

Our backend AI Classifier automatically routes your complaints to the correct department based on keywords in your description.`;
      }

      // Default Citizen Help
      return "Hello! I am your CivicPulse AI assistant chatbot. I can guide you through **submitting new complaints**, **tracking ticket status**, looking up **department contact sheets**, or answering general municipal questions. Try typing 'my complaints' or 'how do I report an issue'!";
    }

    // ─── Officer & Admin Assistance Flow ───
    if (user.role === 'officer' || user.role === 'admin') {
      // 1. Complaint Lookup by ID (officers have full system visibility)
      const idMatch = cleanText.match(/[0-9a-f]{24}/i);
      if (idMatch) {
        const ticketId = idMatch[0];
        const ticket = await Complaint.findById(ticketId).populate('citizen', 'firstName lastName email');

        if (!ticket) {
          return "I couldn't find a system complaint matching that ID. Please check the hex identifier.";
        }

        const lastTimeline = ticket.timeline[ticket.timeline.length - 1];
        return `**[INTERNAL RETAIL SHEET] ID: ${ticket._id}**
• **Title**: "${ticket.title}"
• **Submitter**: ${ticket.citizen ? (ticket.citizen as any).firstName + ' ' + (ticket.citizen as any).lastName : 'Citizen'} (${(ticket.citizen as any)?.email || 'N/A'})
• **Status**: **${ticket.status.toUpperCase()}** (Priority: *${ticket.aiAnalysis ? ticket.aiAnalysis.priority.toUpperCase() : 'MEDIUM'}*)
• **Assigned Agency**: ${ticket.department || 'None'}
• **AI Classification Confidence**: ${ticket.aiAnalysis ? ticket.aiAnalysis.confidenceScore : 0}%

**Suggested Actions**:
- If status is *submitted*, review coordinates and reassign/dispatch.
- If status is *assigned*, allocate to an active field worker.
- Current timeline last updated: ${lastTimeline ? lastTimeline.description : 'N/A'}`;
      }

      // 2. Admin System / Analytics Guide
      if (user.role === 'admin' && (cleanText.includes('analytics') || cleanText.includes('stats') || cleanText.includes('system info'))) {
        return `**CivicPulse Administration Dashboard Diagnostics Guide**:
• **Overview Cards**: Tracks total Citizens, incident counts, pending audit files, active workloads, and resolved cases.
• **Monthly Complaint Trends**: SVG line chart tracking ticket creation vs resolution rates over the past 6 months.
• **AI Diagnostics**: Gauge charts highlighting predicted category precision, severity weights, and duplicate detection performance (baseline 92%).
• **Heatmap Coordinates**: Density plot highlighting localized ticket concentrations ready for GIS integration.
• **System Ledger**: Ledger tracking security locks, deactivations, and reassignments.

Let me know if you want to inspect a specific ticket by pasting its ID!`;
      }

      // Default Admin/Officer Help
      return `Welcome, ${user.role === 'admin' ? 'Administrator' : 'Officer'}! I am the internal control AI assistant. I can:
1. Provide summaries and suggested workflow steps for any incident ticket (paste the 24-character hex ID).
2. Look up related complaints coordinates.
3. Guide you through dashboard analytics and control panels.

What can I assist you with today?`;
    }

    return "Hello! I am your CivicPulse AI assistant. How can I assist you today?";
  }
}

export const aiChatService = new AIChatService();
