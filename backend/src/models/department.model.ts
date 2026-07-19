import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDepartmentHistory {
  officerId: mongoose.Types.ObjectId;
  action: 'assigned' | 'removed';
  timestamp: Date;
}

export interface IDepartment {
  name: string;
  description: string;
  contactInfo: string;
  status: 'active' | 'inactive';
  officers: mongoose.Types.ObjectId[];
  assignmentHistory: IDepartmentHistory[];
}

export interface IDepartmentDocument extends IDepartment, Document {
  createdAt: Date;
  updatedAt: Date;
}

const departmentHistorySchema = new Schema<IDepartmentHistory>({
  officerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, enum: ['assigned', 'removed'], required: true },
  timestamp: { type: Date, default: Date.now, required: true }
});

const departmentSchema = new Schema<IDepartmentDocument>(
  {
    name: {
      type: String,
      required: [true, 'Department name is required'],
      unique: true,
      trim: true
    },
    description: {
      type: String,
      required: [true, 'Department description is required']
    },
    contactInfo: {
      type: String,
      required: [true, 'Contact information is required']
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      required: true
    },
    officers: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }],
    assignmentHistory: [departmentHistorySchema]
  },
  {
    timestamps: true
  }
);

departmentSchema.index({ status: 1 });

const Department: Model<IDepartmentDocument> = mongoose.model<IDepartmentDocument>('Department', departmentSchema);

export default Department;
