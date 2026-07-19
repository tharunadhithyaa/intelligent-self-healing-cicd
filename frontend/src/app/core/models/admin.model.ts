import { User } from './user.model';

export interface OverviewStats {
  totalUsers: number;
  totalComplaints: number;
  totalDepartments: number;
  totalOfficers: number;
  totalFieldWorkers: number;
  pendingComplaints: number;
  resolvedComplaints: number;
}

export interface MonthlyTrend {
  month: string;
  count: number;
  resolved: number;
}

export interface AIAccuracyMetrics {
  categoryAccuracy: number;
  priorityAccuracy: number;
  duplicatePerformance: number;
  averageConfidence: number;
}

export interface HeatmapItem {
  id: string;
  title: string;
  category: string;
  status: string;
  latitude: number;
  longitude: number;
  address: string;
}

export interface Department {
  _id: string;
  name: string;
  description: string;
  contactInfo: string;
  status: 'active' | 'inactive';
  officers: User[];
  assignmentHistory: Array<{
    officerId: string;
    action: 'assigned' | 'removed';
    timestamp: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  _id: string;
  actor?: User;
  actorEmail?: string;
  actorRole?: string;
  action: string;
  target?: string;
  targetId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

export interface AdminReportData {
  timeframe: string;
  startDate: string;
  endDate: string;
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

export interface InAppNotification {
  _id: string;
  recipient: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  relatedEntityId?: string;
  createdAt: string;
}
