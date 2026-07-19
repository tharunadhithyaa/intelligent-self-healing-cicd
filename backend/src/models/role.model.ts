import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRole {
  name: string; // citizen, officer, admin, or custom roles
  permissions: string[];
  description: string;
}

export interface IRoleDocument extends IRole, Document {
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new Schema<IRoleDocument>(
  {
    name: {
      type: String,
      required: [true, 'Role name is required'],
      unique: true,
      trim: true,
      lowercase: true
    },
    permissions: [{
      type: String,
      required: true
    }],
    description: {
      type: String,
      required: [true, 'Role description is required']
    }
  },
  {
    timestamps: true
  }
);



const Role: Model<IRoleDocument> = mongoose.model<IRoleDocument>('Role', roleSchema);

export default Role;
