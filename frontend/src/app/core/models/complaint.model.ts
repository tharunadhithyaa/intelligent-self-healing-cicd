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

export interface ComplaintImage {
  base64Data?: string;
  contentType: string;
  fileName: string;
}

export interface ComplaintTimeline {
  status: string;
  title: string;
  description: string;
  timestamp: string;
  performedBy?: string;
}

export interface AIAnalysis {
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  department: string;
  duplicateDetected: boolean;
  duplicateWarning?: string;
  summary: string;
  confidenceScore: number;
}

export interface Complaint {
  _id: string;
  citizen: string;
  title: string;
  description: string;
  category: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  department?: string;
  date: string;
  status: string;
  aiAnalysis?: AIAnalysis;
  images: ComplaintImage[];
  beforeImages: ComplaintImage[];
  afterImages: ComplaintImage[];
  timeline: ComplaintTimeline[];
  assignment?: {
    officer?: string;
    fieldWorker?: string;
    assignedAt?: string;
    officerNotes?: string;
    resolutionUpdates?: string;
  };
  internalNotes?: Array<{
    text: string;
    authorId: string;
    authorName: string;
    timestamp: string;
  }>;
  resolutionNotes?: {
    description: string;
    completedAt?: string;
    details?: string;
  };
  createdAt: string;
  updatedAt: string;
}
