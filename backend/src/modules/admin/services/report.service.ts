import Complaint, { IComplaintDocument } from "../../../models/complaint.model";
import Department, { IDepartmentDocument } from "../../../models/department.model";

export interface ReportData {
  timeframe: string;
  startDate: Date;
  endDate: Date;
  summary: {
    totalComplaints: number;
    pendingCount: number;
    inProgressCount: number;
    resolvedCount: number;
    closedCount: number;
    avgResolutionHours: number;
  };
  departments: Array<{
    name: string;
    total: number;
    resolved: number;
    pending: number;
    resolutionRate: number;
  }>;
  aiStats: {
    avgConfidence: number;
    duplicateCount: number;
  };
}

class ReportService {
  async generateReport(
    range: "daily" | "weekly" | "monthly" | "yearly",
  ): Promise<ReportData> {
    const { startDate, endDate } = this.getDateRange(range);

    // 1. Fetch complaints in range
    const complaints = await Complaint.find({
      createdAt: { $gte: startDate, $lte: endDate },
    }).exec();

    // 2. Compute status & AI statistics
    const stats = this.calculateComplaintStatistics(complaints);

    // 3. Compute department allocations
    const depts = await Department.find().exec();
    const departmentStats = this.calculateDepartmentStatistics(
      depts,
      complaints,
    );

    return {
      timeframe: range,
      startDate,
      endDate,
      summary: {
        totalComplaints: complaints.length,
        pendingCount: stats.pendingCount,
        inProgressCount: stats.inProgressCount,
        resolvedCount: stats.resolvedCount,
        closedCount: stats.closedCount,
        avgResolutionHours: stats.avgResolutionHours,
      },
      departments: departmentStats,
      aiStats: {
        avgConfidence: stats.avgConfidence,
        duplicateCount: stats.duplicateCount,
      },
    };
  }

  private getDateRange(range: "daily" | "weekly" | "monthly" | "yearly"): {
    startDate: Date;
    endDate: Date;
  } {
    const endDate = new Date();
    const startDate = new Date();

    switch (range) {
      case "daily":
        startDate.setDate(endDate.getDate() - 1);
        break;
      case "weekly":
        startDate.setDate(endDate.getDate() - 7);
        break;
      case "monthly":
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case "yearly":
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
    }

    return { startDate, endDate };
  }

  private calculateComplaintStatistics(complaints: IComplaintDocument[]) {
    const counts = {
      pendingCount: 0,
      inProgressCount: 0,
      resolvedCount: 0,
      closedCount: 0,
    };

    let totalResolutionTimeMs = 0;
    let resolvedWithTimeCount = 0;

    const aiStats = {
      aiConfidenceSum: 0,
      aiConfidenceCount: 0,
      duplicateCount: 0,
    };

    for (const c of complaints) {
      this.incrementStatusCount(c.status, counts);

      const duration = this.calculateResolutionDuration(c);
      if (duration !== null) {
        totalResolutionTimeMs += duration;
        resolvedWithTimeCount++;
      }

      this.processAiAnalysis(c, aiStats);
    }

    const avgResolutionHours =
      resolvedWithTimeCount > 0
        ? Math.round(
            totalResolutionTimeMs / (1000 * 60 * 60) / resolvedWithTimeCount,
          )
        : 0;

    const avgConfidence =
      aiStats.aiConfidenceCount > 0
        ? Math.round(aiStats.aiConfidenceSum / aiStats.aiConfidenceCount)
        : 0;

    return {
      pendingCount: counts.pendingCount,
      inProgressCount: counts.inProgressCount,
      resolvedCount: counts.resolvedCount,
      closedCount: counts.closedCount,
      avgResolutionHours,
      avgConfidence,
      duplicateCount: aiStats.duplicateCount,
    };
  }

  private incrementStatusCount(
    status: string,
    counts: {
      pendingCount: number;
      inProgressCount: number;
      resolvedCount: number;
      closedCount: number;
    },
  ): void {
    switch (status) {
      case "submitted":
        counts.pendingCount++;
        break;
      case "ai_reviewed":
      case "assigned":
      case "in_progress":
        counts.inProgressCount++;
        break;
      case "resolved":
        counts.resolvedCount++;
        break;
      case "closed":
        counts.closedCount++;
        break;
    }
  }

  private calculateResolutionDuration(c: IComplaintDocument): number | null {
    if (!["resolved", "closed"].includes(c.status)) {
      return null;
    }
    const resolutionStep = c.timeline.find((t) => t.status === "resolved");
    if (!resolutionStep) {
      return null;
    }
    return resolutionStep.timestamp.getTime() - c.createdAt.getTime();
  }

  private processAiAnalysis(
    c: IComplaintDocument,
    stats: {
      aiConfidenceSum: number;
      aiConfidenceCount: number;
      duplicateCount: number;
    },
  ): void {
    if (!c.aiAnalysis) {
      return;
    }
    stats.aiConfidenceSum += c.aiAnalysis.confidenceScore;
    stats.aiConfidenceCount++;
    if (c.aiAnalysis.duplicateDetected) {
      stats.duplicateCount++;
    }
  }

  private calculateDepartmentStatistics(
    depts: IDepartmentDocument[],
    complaints: IComplaintDocument[],
  ) {
    return depts.map((d) => {
      const deptComplaints = complaints.filter((c) => c.department === d.name);
      const total = deptComplaints.length;
      const resolved = deptComplaints.filter((c) =>
        ["resolved", "closed"].includes(c.status),
      ).length;
      const pending = total - resolved;
      const resolutionRate =
        total > 0 ? Math.round((resolved / total) * 100) : 0;

      return {
        name: d.name,
        total,
        resolved,
        pending,
        resolutionRate,
      };
    });
  }

  convertToCSV(report: ReportData): string {
    const lines: string[] = [];

    lines.push(
      `CivicPulse Administrative Summary Report (${report.timeframe.toUpperCase()})`,
      `Date Range: ${report.startDate.toLocaleDateString()} to ${report.endDate.toLocaleDateString()}`,
      "",
      "--- SUMMARY STATISTICS ---",
      "Metric,Value",
      `Total Incident Tickets,${report.summary.totalComplaints}`,
      `Pending Review,${report.summary.pendingCount}`,
      `Work In Progress,${report.summary.inProgressCount}`,
      `Resolved Tickets,${report.summary.resolvedCount}`,
      `Closed Tickets,${report.summary.closedCount}`,
      `Average Resolution Duration (Hours),${report.summary.avgResolutionHours}`,
      "",
      "--- AI CLASSIFIER STATISTICS ---",
      "Metric,Value",
      `AI Classifier Confidence,${report.aiStats.avgConfidence}%`,
      `Duplicate Flags Triggered,${report.aiStats.duplicateCount}`,
      "",
      "--- DEPARTMENT PERFORMANCE ---",
      "Department Name,Total Assigned,Resolved Cases,Active Load,Resolution Rate (%)",
    );

    for (const d of report.departments) {
      lines.push(
        `"${d.name}",${d.total},${d.resolved},${d.pending},${d.resolutionRate}%`,
      );
    }

    return lines.join("\n");
  }
}

export const reportService = new ReportService();
