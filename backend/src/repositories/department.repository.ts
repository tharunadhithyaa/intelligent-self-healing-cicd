import { BaseRepository } from './base.repository';
import Department, { IDepartmentDocument } from '../models/department.model';

export class DepartmentRepository extends BaseRepository<IDepartmentDocument> {
  constructor() {
    super(Department);
  }

  async findWithOfficers(): Promise<IDepartmentDocument[]> {
    return this.model
      .find()
      .populate('officers', 'firstName lastName email role phone')
      .exec();
  }
}

export const departmentRepository = new DepartmentRepository();
