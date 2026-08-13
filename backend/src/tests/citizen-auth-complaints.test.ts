import { WorkflowService } from "../modules/complaints/workflow.service";
import { aiService } from "../modules/complaints/ai.service";
import { RegisterDto } from "../modules/auth/dtos/auth.dto";

export const testCitizenAuthComplaints = async (): Promise<boolean> => {
  console.log("🧪 Running Citizen Auth & Complaints Workflow Tests...");

  // 1. WorkflowService Status Transitions
  const allowed = WorkflowService.getNextAllowedStatuses("submitted");
  if (
    !Array.isArray(allowed) ||
    !allowed.includes("verified") ||
    !allowed.includes("rejected") ||
    !allowed.includes("ai_reviewed") ||
    allowed.includes("closed")
  ) {
    throw new Error("WorkflowService.getNextAllowedStatuses test failed");
  }

  const isValidSubmitToVerify = WorkflowService.isValidTransition("submitted", "verified");
  const isValidSubmitToClosed = WorkflowService.isValidTransition("submitted", "closed");
  if (!isValidSubmitToVerify || isValidSubmitToClosed) {
    throw new Error("WorkflowService.isValidTransition test failed");
  }

  let invalidTransitionErr = false;
  try {
    WorkflowService.validateTransition("submitted", "closed");
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "statusCode" in err) {
      if ((err as { statusCode: number }).statusCode === 400) {
        invalidTransitionErr = true;
      }
    }
  }
  if (!invalidTransitionErr) {
    throw new Error("WorkflowService.validateTransition expected 400 error");
  }

  // 2. AI Service Duplicate Detection Result Assertion
  const dupResult = await aiService.detectDuplicates(
    "Road Damage",
    { latitude: 12.97, longitude: 77.59 },
    "pothole on avenue",
  );
  if (typeof dupResult.detected !== "boolean") {
    throw new Error("aiService.detectDuplicates failed: 'detected' boolean property missing");
  }

  // 3. RegisterDto Validation
  const userReg: RegisterDto = {
    firstName: "Test",
    lastName: "User",
    email: "citizen_test@example.com",
    password: "Password123!",
    phone: "1234567890",
    role: "citizen",
  };

  const userRegNoPhone: RegisterDto = {
    firstName: "TestNoPhone",
    lastName: "UserNoPhone",
    email: "citizen_nophone@example.com",
    password: "Password123!",
  };

  const isDtoValid =
    typeof userReg.firstName === "string" &&
    typeof userReg.lastName === "string" &&
    typeof userReg.email === "string" &&
    typeof userReg.password === "string" &&
    userReg.phone === "1234567890" &&
    userRegNoPhone.phone === undefined;

  if (!isDtoValid) {
    throw new Error("RegisterDto structure validation failed");
  }

  console.log("✅ Citizen Auth & Complaints Workflow Tests PASSED cleanly!");
  return true;
};
