import Complaint from "../../../models/complaint.model";
import Department from "../../../models/department.model";

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
    const endDate = new Date();
    const startDate = new Date();

    if (range === "daily") {
      startDate.setDate(endDate.getDate() - 1);
    } else if (range === "weekly") {
      startDate.setDate(endDate.getDate() - 7);
    } else if (range === "monthly") {
      startDate.setMonth(endDate.getMonth() - 1);
    } else {
      startDate.setFullYear(endDate.getFullYear() - 1);
    }

    // 1. Fetch complaints in range
    const complaints = await Complaint.find({
      createdAt: { $gte: startDate, $lte: endDate },
    }).exec();

    // 2. Compute status counts
    let pendingCount = 0;
    let inProgressCount = 0;
    let resolvedCount = 0;
    let closedCount = 0;
    let totalResolutionTimeMs = 0;
    let resolvedWithTimeCount = 0;

    let aiConfidenceSum = 0;
    let aiConfidenceCount = 0;
    let duplicateCount = 0;

    for (const c of complaints) {
      if (c.status === "submitted") pendingCount++;
      else if (["ai_reviewed", "assigned", "in_progress"].includes(c.status))
        inProgressCount++;
      else if (c.status === "resolved") resolvedCount++;
      else if (c.status === "closed") closedCount++;

      // Resolution speed check: duration between createdAt and resolution date (last timeline step)
      if (["resolved", "closed"].includes(c.status)) {
        const resolutionStep = c.timeline.find((t) => t.status === "resolved");
        if (resolutionStep) {
          const duration =
            resolutionStep.timestamp.getTime() - c.createdAt.getTime();
          totalResolutionTimeMs += duration;
          resolvedWithTimeCount++;
        }
      }

      if (c.aiAnalysis) {
        aiConfidenceSum += c.aiAnalysis.confidenceScore;
        aiConfidenceCount++;
        if (c.aiAnalysis.duplicateDetected) {
          duplicateCount++;
        }
      }
    }

    const avgResolutionHours =
      resolvedWithTimeCount > 0
        ? Math.round(
            totalResolutionTimeMs / (1000 * 60 * 60) / resolvedWithTimeCount,
          )
        : 0;

    const avgConfidence =
      aiConfidenceCount > 0
        ? Math.round(aiConfidenceSum / aiConfidenceCount)
        : 0;

    // 3. Compute department allocations
    const depts = await Department.find().exec();
    const departmentStats = depts.map((d) => {
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

    return {
      timeframe: range,
      startDate,
      endDate,
      summary: {
        totalComplaints: complaints.length,
        pendingCount,
        inProgressCount,
        resolvedCount,
        closedCount,
        avgResolutionHours,
      },
      departments: departmentStats,
      aiStats: {
        avgConfidence,
        duplicateCount,
      },
    };
  }

  convertToCSV(report: ReportData): string {
    const lines: string[] = [];

    // Header
    lines.push(
      `CivicPulse Administrative Summary Report (${report.timeframe.toUpperCase()})`,
    );
    lines.push(
      `Date Range: ${report.startDate.toLocaleDateString()} to ${report.endDate.toLocaleDateString()}`,
    );
    lines.push("");

    // Summary Section
    lines.push("--- SUMMARY STATISTICS ---");
    lines.push("Metric,Value");
    lines.push(`Total Incident Tickets,${report.summary.totalComplaints}`);
    lines.push(`Pending Review,${report.summary.pendingCount}`);
    lines.push(`Work In Progress,${report.summary.inProgressCount}`);
    lines.push(`Resolved Tickets,${report.summary.resolvedCount}`);
    lines.push(`Closed Tickets,${report.summary.closedCount}`);
    lines.push(
      `Average Resolution Duration (Hours),${report.summary.avgResolutionHours}`,
    );
    lines.push("");

    // AI Section
    lines.push("--- AI CLASSIFIER STATISTICS ---");
    lines.push("Metric,Value");
    lines.push(`AI Classifier Confidence,${report.aiStats.avgConfidence}%`);
    lines.push(`Duplicate Flags Triggered,${report.aiStats.duplicateCount}`);
    lines.push("");

    // Department Section
    lines.push("--- DEPARTMENT PERFORMANCE ---");
    lines.push(
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
