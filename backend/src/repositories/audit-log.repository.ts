import { BaseRepository } from './base.repository';
import AuditLog, { IAuditLogDocument } from '../models/audit-log.model';

export class AuditLogRepository extends BaseRepository<IAuditLogDocument> {
  constructor() {
    super(AuditLog);
  }

  async findPaginated(
    filter: Record<string, any>,
    sort: Record<string, any>,
    skip: number,
    limit: number
  ): Promise<IAuditLogDocument[]> {
    return this.model
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('actor', 'firstName lastName email role')
      .exec();
  }
}

export const auditLogRepository = new AuditLogRepository();
