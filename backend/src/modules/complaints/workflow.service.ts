import { ComplaintStatus } from "../../models/complaint.model";
import { ApiError } from "../../utils/api-error.util";

export class WorkflowService {
  private static readonly transitions: Record<
    ComplaintStatus,
    ComplaintStatus[]
  > = {
    submitted: ["verified", "rejected", "ai_reviewed"],
    ai_reviewed: ["verified", "rejected", "assigned"],
    verified: ["assigned", "rejected"],
    assigned: ["in_progress"],
    in_progress: ["waiting", "resolved"],
    waiting: ["in_progress", "resolved"],
    resolved: ["closed"],
    rejected: [],
    closed: [],
  };

  static isValidTransition(
    current: ComplaintStatus,
    next: ComplaintStatus,
  ): boolean {
    const allowed = this.transitions[current] || [];
    return allowed.includes(next);
  }

  static validateTransition(
    current: ComplaintStatus,
    next: ComplaintStatus,
  ): void {
    if (current === next) return;
    if (!this.isValidTransition(current, next)) {
      throw ApiError.badRequest(
        `Invalid status transition: Cannot change status from "${current}" to "${next}"`,
      );
    }
  }
}
