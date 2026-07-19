import mongoose, { Schema, Document, Model } from 'mongoose';

export const COMPLAINT_CATEGORIES = [
  'Road Damage',
  'Garbage Management',
  'Streetlight Issue',
  'Water Supply',
  'Drainage Problem',
  'Traffic Issue',
  'Public Safety',
  'Electricity Issue',
  'Other'
] as const;

export type ComplaintCategory = typeof COMPLAINT_CATEGORIES[number];

export const COMPLAINT_STATUSES = [
  'submitted',
  'ai_reviewed',
  'verified',
  'assigned',
  'in_progress',
  'waiting',
  'resolved',
  'rejected',
  'closed'
] as const;

export type ComplaintStatus = typeof COMPLAINT_STATUSES[number];

export interface IComplaintImage {
  base64Data: string;
  contentType: string;
  fileName: string;
}

export interface IComplaintTimeline {
  status: ComplaintStatus;
  title: string;
  description: string;
  timestamp: Date;
  performedBy?: mongoose.Types.ObjectId;
}

export interface IAIAnalysis {
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  department: string;
  duplicateDetected: boolean;
  duplicateWarning?: string;
  summary: string;
  confidenceScore: number; // overall percentage (0-100)
}

export interface IInternalNote {
  text: string;
  authorId: mongoose.Types.ObjectId;
  authorName: string;
  timestamp: Date;
}

export interface IResolutionNotes {
  description: string;
  completedAt?: Date;
  details?: string;
}

export interface IComplaint {
  citizen: mongoose.Types.ObjectId;
  title: string;
  description: string;
  category: ComplaintCategory;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  department?: string;
  date: Date;
  status: ComplaintStatus;
  aiAnalysis?: IAIAnalysis;
  images: IComplaintImage[];
  beforeImages: IComplaintImage[];
  afterImages: IComplaintImage[];
  timeline: IComplaintTimeline[];
  assignment?: {
    officer?: mongoose.Types.ObjectId;
    fieldWorker?: mongoose.Types.ObjectId;
    assignedAt?: Date;
    officerNotes?: string;
    resolutionUpdates?: string;
  };
  internalNotes: IInternalNote[];
  resolutionNotes?: IResolutionNotes;
}

export interface IComplaintDocument extends IComplaint, Document {
  createdAt: Date;
  updatedAt: Date;
}

const complaintImageSchema = new Schema<IComplaintImage>({
  base64Data: { type: String, required: true },
  contentType: { type: String, required: true },
  fileName: { type: String, required: true }
});

const complaintTimelineSchema = new Schema<IComplaintTimeline>({
  status: { type: String, enum: COMPLAINT_STATUSES, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  timestamp: { type: Date, default: Date.now, required: true },
  performedBy: { type: Schema.Types.ObjectId, ref: 'User' }
});

const aiAnalysisSchema = new Schema<IAIAnalysis>({
  category: { type: String, required: true },
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
  department: { type: String, required: true },
  duplicateDetected: { type: Boolean, default: false },
  duplicateWarning: { type: String },
  summary: { type: String, required: true },
  confidenceScore: { type: Number, required: true }
});

const complaintSchema = new Schema<IComplaintDocument>(
  {
    citizen: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: {
      type: String,
      required: [true, 'Complaint title is required'],
      trim: true,
      minlength: [5, 'Title must be at least 5 characters'],
      maxlength: [100, 'Title cannot exceed 100 characters']
    },
    description: {
      type: String,
      required: [true, 'Complaint description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters']
    },
    category: {
      type: String,
      enum: COMPLAINT_CATEGORIES,
      required: [true, 'Complaint category is required'],
      index: true
    },
    location: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      address: { type: String, required: true }
    },
    department: { type: String },
    date: { type: Date, default: Date.now, required: true },
    status: {
      type: String,
      enum: COMPLAINT_STATUSES,
      default: 'submitted',
      required: true,
      index: true
    },
    aiAnalysis: { type: aiAnalysisSchema },
    images: [complaintImageSchema],
    beforeImages: { type: [complaintImageSchema], default: [] },
    afterImages: { type: [complaintImageSchema], default: [] },
    timeline: [complaintTimelineSchema],
    assignment: {
      officer: { type: Schema.Types.ObjectId, ref: 'User' },
      fieldWorker: { type: Schema.Types.ObjectId, ref: 'User' },
      assignedAt: { type: Date },
      officerNotes: { type: String },
      resolutionUpdates: { type: String }
    },
    internalNotes: [{
      text: { type: String, required: true },
      authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      authorName: { type: String, required: true },
      timestamp: { type: Date, default: Date.now, required: true }
    }],
    resolutionNotes: {
      description: { type: String },
      completedAt: { type: Date },
      details: { type: String }
    }
  },
  {
    timestamps: true
  }
);

// Indexes for common queries
complaintSchema.index({ citizen: 1, status: 1 });
complaintSchema.index({ status: 1, category: 1 });

const Complaint: Model<IComplaintDocument> = mongoose.model<IComplaintDocument>('Complaint', complaintSchema);

export default Complaint;
