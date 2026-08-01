import mongoose, { Schema, Document, Model } from "mongoose";

export interface IChatMessage {
  sender: "user" | "bot";
  text: string;
  timestamp: Date;
}

export interface IConversation {
  userId: mongoose.Types.ObjectId;
  role: "citizen" | "officer" | "field_worker" | "admin";
  messages: IChatMessage[];
}

export interface IConversationDocument extends IConversation, Document {
  createdAt: Date;
  updatedAt: Date;
}

const chatMessageSchema = new Schema<IChatMessage>({
  sender: { type: String, enum: ["user", "bot"], required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now, required: true },
});

const conversationSchema = new Schema<IConversationDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["citizen", "officer", "field_worker", "admin"],
      required: true,
    },
    messages: [chatMessageSchema],
  },
  {
    timestamps: true,
  },
);

conversationSchema.index({ userId: 1, updatedAt: -1 });

const Conversation: Model<IConversationDocument> =
  mongoose.model<IConversationDocument>("Conversation", conversationSchema);

export default Conversation;
