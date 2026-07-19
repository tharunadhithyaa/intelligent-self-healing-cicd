import mongoose from 'mongoose';
import { auditLogRepository } from '../../../repositories/audit-log.repository';
import { IAuditLogDocument } from '../../../models/audit-log.model';

export interface AuditLogInput {
  actorId?: string;
  actorEmail?: string;
  actorRole?: string;
  action: string;
  target?: string;
  targetId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

class AuditService {
  async log(data: AuditLogInput): Promise<void> {
    try {
      await auditLogRepository.create({
        actor: data.actorId ? new mongoose.Types.ObjectId(data.actorId) : undefined,
        actorEmail: data.actorEmail,
        actorRole: data.actorRole,
        action: data.action,
        target: data.target,
        targetId: data.targetId,
        details: data.details,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        timestamp: new Date()
      } as Partial<IAuditLogDocument>);
    } catch (err) {
      console.error('Failed to write audit log:', err);
    }
  }

  async getAuditLogs(
    search?: string,
    action?: string,
    role?: string,
    target?: string,
    startDate?: string,
    endDate?: string,
    sortField = 'timestamp',
    sortOrder = 'desc',
    page = 1,
    limit = 10
  ): Promise<{ logs: IAuditLogDocument[]; total: number }> {
    const filter: Record<string, any> = {};

    if (action) {
      filter.action = action;
    }
    if (role) {
      filter.actorRole = role;
    }
    if (target) {
      filter.target = target;
    }

    // Date range filtering
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) {
        filter.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.timestamp.$lte = new Date(endDate);
      }
    }

    // Keyword search
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filter.$or = [
        { actorEmail: searchRegex },
        { action: searchRegex },
        { target: searchRegex }
      ];
    }

    const sort: Record<string, any> = { [sortField]: sortOrder === 'desc' ? -1 : 1 };
    const skip = (page - 1) * limit;

    const logs = await auditLogRepository.findPaginated(filter, sort, skip, limit);
    const total = await auditLogRepository.count(filter);

    return { logs, total };
  }
}

export const auditService = new AuditService();
