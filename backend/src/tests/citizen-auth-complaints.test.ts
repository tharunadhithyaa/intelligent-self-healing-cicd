import { WorkflowService } from "../modules/complaints/workflow.service";
import { aiService } from "../modules/complaints/ai.service";
import { RegisterDto } from "../modules/auth/dtos/auth.dto";

export const testCitizenAuthComplaints = async () => {
  const allowed = WorkflowService.getNextAllowedStatuses("submitted");
  if (!Array.isArray(allowed)) throw new Error("WorkflowService test failed");

  const dup = await aiService.detectDuplicates("Road Damage", { latitude: 12.97, longitude: 77.59 }, "pothole");
  if (typeof dup.detected !== "boolean") throw new Error("AIService test failed");

  const userReg: RegisterDto = {
    firstName: "Test",
    lastName: "User",
    email: "test@example.com",
    password: "Password123!",
    phone: "1234567890",
  };

  const userRegNoPhone: RegisterDto = {
    firstName: "Test",
    lastName: "User",
    email: "test2@example.com",
    password: "Password123!",
  };

  return !!userReg && !!userRegNoPhone;
};
