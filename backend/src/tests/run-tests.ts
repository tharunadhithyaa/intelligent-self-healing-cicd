import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/user.model";
import Complaint from "../models/complaint.model";
import Role from "../models/role.model";
import { hashPassword, comparePassword } from "../utils/password.util";
import {
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  getRefreshTokenExpiryDate,
} from "../utils/jwt.util";
import config from "../config";
import { aiService } from "../modules/complaints/ai.service";
import { apiCache } from "../utils/cache.util";
import { securitySanitizer } from "../middleware/security.middleware";
import { adminController } from "../modules/admin/admin.controller";
import { userManagementService } from "../modules/admin/services/user-management.service";
import { officerService } from "../modules/officer/officer.service";
import { fieldWorkerService } from "../modules/field-worker/field-worker.service";
import { reportService } from "../modules/admin/services/report.service";
import { aiChatService } from "../modules/ai-chat/ai-chat.service";
import { auditService } from "../modules/admin/services/audit.service";
import { auditLogRepository } from "../repositories/audit-log.repository";
import Department from "../models/department.model";
import { logger, logFormat, consoleFormat } from "../utils/logger.util";
import { runDepartmentAndNotificationTests } from "./department-and-notification.test";
import { runAdminDashboardAndUserMgmtTests } from "./admin-dashboard-and-user-mgmt.test";
import { runFieldWorkerAndOfficerTests } from "./field-worker-and-officer.test";
import { runRepositoriesAndAiWorkflowTests } from "./repositories-and-ai-workflow.test";
import { runAdminControllerFullTests } from "./admin-controller.test";

dotenv.config();

const getMongoUri = () => {
  const uri =
    process.env["TEST_MONGODB_URI"] ||
    process.env["MONGODB_URI"] ||
    "mongodb://127.0.0.1:27017/civicpulse_test";
  return uri.replace("mongodb://mongodb:", "mongodb://127.0.0.1:");
};

const logTest = (name: string, passed: boolean, details?: string) => {
  const symbol = passed ? "✅" : "❌";
  const status = passed ? "PASSED" : "FAILED";
  const detailsSuffix = details ? ` (${details})` : "";
  console.log(`${symbol} [${status}] - ${name}${detailsSuffix}`);
};

const executeTest = async (
  name: string,
  testFn: () => Promise<boolean | { passed: boolean; details?: string }>,
) => {
  try {
    const result = await testFn();
    if (typeof result === "boolean") {
      logTest(name, result);
    } else {
      logTest(name, result.passed, result.details);
    }
  } catch (e: any) {
    logTest(name, false, e.message);
  }
};

const connectTestDatabase = async (): Promise<boolean> => {
  console.log("🚀 Starting CivicPulse Production Integration Test Suite...");
  console.log("🔗 Connecting to test MongoDB instance...");

  const mongoUri = getMongoUri();
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log(`✅ MongoDB connection successful: ${mongoUri}`);
    console.log("Cleaning up test database...\n");

    await Promise.all([
      User.deleteMany({ email: /@test\.com$/ }),
      Complaint.deleteMany({ title: /\[TEST\]/ }),
      Role.deleteMany({ name: "test_role" }),
    ]);
    return true;
  } catch (err: any) {
    console.error(`\n❌ FATAL: MongoDB connection failed (${mongoUri}): ${err.message}`);
    console.error("❌ MongoDB is unavailable. Cannot run database integration test suite!\n");
    throw new Error(`MongoDB is unavailable at ${mongoUri}: ${err.message}`);
  }
};

const disconnectTestDatabase = async (isDbConnected: boolean): Promise<void> => {
  if (isDbConnected) {
    await mongoose.disconnect();
    console.log("🔌 Disconnected database.");
  }
};

const runPasswordTests = () =>
  executeTest("Password Encryption & Comparison", async () => {
    const password =
      process.env["TEST_PASSWORD"] || `TestSecretPassword_${Date.now()}`;
    const hash = await hashPassword(password);
    const isMatch = await comparePassword(password, hash);
    const isMatchWrong = await comparePassword("wrong_password", hash);
    return isMatch && !isMatchWrong;
  });

const runJwtTests = () =>
  executeTest("JWT Sign, Refresh Verification & Expiry Calculations", async () => {
    const payload = {
      userId: "507f1f77bcf86cd799439011",
      email: "officer@test.com",
      role: "officer",
    };
    const tokens = generateTokenPair(payload);
    const verifiedAccess = verifyAccessToken(tokens.accessToken);
    const verifiedRefresh = verifyRefreshToken(tokens.refreshToken);

    const accessValid =
      verifiedAccess.email === payload.email &&
      verifiedAccess.role === payload.role;
    const refreshValid =
      verifiedRefresh.email === payload.email &&
      verifiedRefresh.role === payload.role;

    // Unit tests for getRefreshTokenExpiryDate (d, h, m, s, and invalid fallback)
    const originalRefreshExpiry = config.jwt.refreshExpiry;

    let daysExpiryValid = false;
    let hoursExpiryValid = false;
    let minutesExpiryValid = false;
    let secondsExpiryValid = false;
    let invalidFallbackValid = false;

    try {
      // 1. Days (7d)
      config.jwt.refreshExpiry = "7d";
      const dDate = getRefreshTokenExpiryDate();
      const dDiff = dDate.getTime() - Date.now();
      daysExpiryValid = dDiff > 6.9 * 24 * 3600 * 1000 && dDiff < 7.1 * 24 * 3600 * 1000;

      // 2. Hours (2h)
      config.jwt.refreshExpiry = "2h";
      const hDate = getRefreshTokenExpiryDate();
      const hDiff = hDate.getTime() - Date.now();
      hoursExpiryValid = hDiff > 1.9 * 3600 * 1000 && hDiff < 2.1 * 3600 * 1000;

      // 3. Minutes (30m)
      config.jwt.refreshExpiry = "30m";
      const mDate = getRefreshTokenExpiryDate();
      const mDiff = mDate.getTime() - Date.now();
      minutesExpiryValid = mDiff > 29 * 60 * 1000 && mDiff < 31 * 60 * 1000;

      // 4. Seconds (45s)
      config.jwt.refreshExpiry = "45s";
      const sDate = getRefreshTokenExpiryDate();
      const sDiff = sDate.getTime() - Date.now();
      secondsExpiryValid = sDiff > 44 * 1000 && sDiff < 46 * 1000;

      // 5. Invalid string (triggers 7-day fallback)
      config.jwt.refreshExpiry = "invalid_expiry_format";
      const fallbackDate = getRefreshTokenExpiryDate();
      const fallbackDiff = fallbackDate.getTime() - Date.now();
      invalidFallbackValid =
        fallbackDiff > 6.9 * 24 * 3600 * 1000 && fallbackDiff < 7.1 * 24 * 3600 * 1000;
    } finally {
      config.jwt.refreshExpiry = originalRefreshExpiry;
    }

    return (
      accessValid &&
      refreshValid &&
      daysExpiryValid &&
      hoursExpiryValid &&
      minutesExpiryValid &&
      secondsExpiryValid &&
      invalidFallbackValid
    );
  });

const runAiClassificationTests = () =>
  executeTest("AI Keyword Classification & Priority Routing", async () => {
    const text = "potholes on the street near main junction";
    const category = (aiService as any).predictCategory(text);
    const priority = (aiService as any).predictPriority(text);
    return {
      passed: category === "Road Damage" && priority === "medium",
      details: `Category: ${category}, Priority: ${priority}`,
    };
  });

const runCacheTests = () =>
  executeTest("In-Memory SimpleCache Performance, Expiration & Invalidation", async () => {
    // 1. Cache miss (key does not exist)
    const nonExistent = apiCache.get<any>("key_does_not_exist_999");
    const missValid = nonExistent === null;

    // 2. Cache hit (item has not expired)
    const cacheKey = "test_key";
    const cacheValue = { departments: ["Sanitation", "PWD"] };
    apiCache.set(cacheKey, cacheValue, 5000);
    const fetched = apiCache.get<any>(cacheKey);
    const hitValid = fetched !== null && fetched.departments[0] === "Sanitation";

    // 3. Deletion behavior
    apiCache.delete(cacheKey);
    const fetchedAfterDelete = apiCache.get<any>(cacheKey);
    const deleteValid = fetchedAfterDelete === null;

    // 4. Expired cache entry branch (expiresAt < Date.now())
    const expiredKey = "expired_key";
    apiCache.set(expiredKey, "expired_value", -50); // ttlMs in past
    const fetchedExpired = apiCache.get<any>(expiredKey); // triggers item.expiresAt < Date.now() -> delete & return null
    const fetchedExpiredAgain = apiCache.get<any>(expiredKey); // key is deleted, returns null
    const expiredValid = fetchedExpired === null && fetchedExpiredAgain === null;

    // 5. Clear cache behavior
    apiCache.set("temp1", "v1", 5000);
    apiCache.set("temp2", "v2", 5000);
    apiCache.clear();
    const clearValid = apiCache.get("temp1") === null && apiCache.get("temp2") === null;

    return missValid && hitValid && deleteValid && expiredValid && clearValid;
  });

const runSecurityMiddlewareTests = () =>
  executeTest("Security Middleware Operator & XSS Sanitization", async () => {
    const req: any = {
      body: {
        username: "admin",
        "$where": "this.password == 123",
        nested: { "key.with.dot": "val", xss: "<script>alert(1)</script>" },
        tags: ["<b>test</b>", { "$ne": null }],
      },
      query: { filter: "safe", "$gt": 0 },
      params: { id: "123" },
    };
    const res: any = {};
    let nextCalled = false;
    securitySanitizer(req, res, () => {
      nextCalled = true;
    });

    return (
      nextCalled &&
      req.body["$where"] === undefined &&
      req.body.nested["key.with.dot"] === undefined &&
      req.body.nested.xss.includes("&lt;script&gt;") &&
      req.body.tags[0].includes("&lt;b&gt;") &&
      req.query["$gt"] === undefined
    );
  });

const runExtendedAiTests = () =>
  executeTest(
    "AI Extended Keyword Classification (Garbage/Water/Streetlight)",
    async () => {
      const textGarbage = "overflowing garbage trash bin in street";
      const catGarbage = (aiService as any).predictCategory(textGarbage);

      const textWater = "broken water pipe leak contamination";
      const catWater = (aiService as any).predictCategory(textWater);

      const textLight = "broken streetlight flickering lamp dark pole";
      const catLight = (aiService as any).predictCategory(textLight);

      return (
        catGarbage === "Garbage Management" &&
        catWater === "Water Supply" &&
        catLight === "Streetlight Issue"
      );
    },
  );

const runAdminControllerTests = () =>
  executeTest("Admin Controller Number.parseInt Pagination Parsing", async () => {
    let pageParsed = 0;
    let limitParsed = 0;
    const req: any = {
      query: {
        page: "2",
        limit: "25",
        search: "john",
        role: "officer",
        isActive: "true",
        isLocked: "false",
      },
    };
    const res: any = {
      status: () => res,
      json: (data: any) => data,
    };

    const origGetUsers = userManagementService.getUsers;
    userManagementService.getUsers = async (options: any) => {
      pageParsed = options.page;
      limitParsed = options.limit;
      return { users: [], total: 0 };
    };

    await adminController.getUsers(req, res, () => {});
    userManagementService.getUsers = origGetUsers;

    return pageParsed === 2 && limitParsed === 25;
  });

const runDatabaseServiceTests = (isDbConnected: boolean) =>
  executeTest("Mongoose Document CRUD & Service Layer Cycle", async () => {
    if (!isDbConnected) {
      return { passed: true, details: "Skipped (no DB connection)" };
    }

    const testUser = await User.create({
      firstName: "Test",
      lastName: "User",
      email: "citizen@test.com",
      password: await hashPassword(
        process.env["TEST_PASSWORD"] || `test_${Date.now()}`,
      ),
      role: "citizen",
      isActive: true,
    });

    const testComplaint = await Complaint.create({
      title: "[TEST] Broken water main leak",
      description: "Large water leakage flooding the road path",
      category: "Water Supply",
      location: { latitude: 12.97, longitude: 77.59, address: "Test St" },
      status: "submitted",
      citizen: testUser._id,
      aiAnalysis: {
        category: "Water Supply",
        priority: "high",
        department: "Water Department",
        duplicateDetected: false,
        summary: "Water leakage",
        confidenceScore: 95,
      },
      timeline: [
        {
          status: "submitted",
          title: "Submitted",
          description: "Report created",
          timestamp: new Date(),
        },
      ],
    });

    const userExists = !!(await User.exists({ email: "citizen@test.com" }));
    const complaintExists = !!(await Complaint.exists({
      title: "[TEST] Broken water main leak",
    }));

    const officerUser = {
      userId: testUser._id.toString(),
      email: testUser.email,
      role: "officer",
    };

    const officerStats = await officerService.getDashboardStats(officerUser);
    const officerComplaints = await officerService.getComplaints(officerUser, {
      page: "1",
      limit: "5",
      status: "submitted",
      priority: "high",
      search: testUser._id.toString(),
    });

    const usersList = await userManagementService.getUsers({
      search: "test",
      role: "citizen",
      page: 1,
      limit: 10,
    });

    const workerJobs = await fieldWorkerService.getAssignedJobs(
      { userId: testUser._id.toString(), email: testUser.email, role: "field_worker" },
      { page: "1", limit: "5", status: "assigned", search: "water" },
    );

    await User.findByIdAndDelete(testUser._id);
    await Complaint.findByIdAndDelete(testComplaint._id);

    return (
      userExists &&
      complaintExists &&
      officerStats !== undefined &&
      officerComplaints.total >= 0 &&
      usersList.total >= 0 &&
      workerJobs.total >= 0
    );
  });

const runReportServiceTests = (isDbConnected: boolean) =>
  executeTest("ReportService generateReport & convertToCSV Generation", async () => {
    if (!isDbConnected) {
      return { passed: true, details: "Skipped (no DB connection)" };
    }

    const testUser = await User.create({
      firstName: "Report",
      lastName: "Tester",
      email: `reporttest_${Date.now()}@test.com`,
      password: "password123",
      role: "citizen",
      isActive: true,
    });

    const deptActive = await Department.create({
      name: "Road Maintenance",
      description: "Fixes roads",
      contactInfo: "555-ROAD",
      status: "active",
    });

    const deptEmpty = await Department.create({
      name: "Parks & Recreation",
      description: "Parks",
      contactInfo: "555-PARK",
      status: "active",
    });

    // Create complaints covering statuses & branches:
    // 1. Submitted (no AI analysis)
    await Complaint.create({
      title: "Broken curb",
      description: "Curb damaged",
      category: "Road Damage",
      department: "Road Maintenance",
      location: { latitude: 12.97, longitude: 77.59, address: "Road 1" },
      status: "submitted",
      citizen: testUser._id,
      timeline: [{ status: "submitted", title: "Sub", description: "Created", timestamp: new Date() }],
    });

    // 2. In progress (with AI analysis & duplicate detected)
    await Complaint.create({
      title: "Pothole main road",
      description: "Pothole issue",
      category: "Road Damage",
      department: "Road Maintenance",
      location: { latitude: 12.97, longitude: 77.59, address: "Road 2" },
      status: "in_progress",
      citizen: testUser._id,
      aiAnalysis: {
        category: "Road Damage",
        priority: "high",
        department: "Road Maintenance",
        duplicateDetected: true,
        summary: "Pothole",
        confidenceScore: 80,
      },
      timeline: [{ status: "in_progress", title: "In Prog", description: "Assigned", timestamp: new Date() }],
    });

    // 3. Resolved with timeline resolution step
    await Complaint.create({
      title: "Fixed streetlight",
      description: "Light fixed",
      category: "Streetlight Issue",
      department: "Road Maintenance",
      location: { latitude: 12.97, longitude: 77.59, address: "Road 3" },
      status: "resolved",
      citizen: testUser._id,
      aiAnalysis: {
        category: "Streetlight Issue",
        priority: "medium",
        department: "Road Maintenance",
        duplicateDetected: false,
        summary: "Light fixed",
        confidenceScore: 90,
      },
      timeline: [
        { status: "submitted", title: "Sub", description: "Created", timestamp: new Date(Date.now() - 3600000 * 5) },
        { status: "resolved", title: "Resolved", description: "Fixed", timestamp: new Date() },
      ],
    });

    // 4. Closed without resolution step
    await Complaint.create({
      title: "Closed ticket no timeline step",
      description: "Closed directly",
      category: "Road Damage",
      department: "Road Maintenance",
      location: { latitude: 12.97, longitude: 77.59, address: "Road 4" },
      status: "closed",
      citizen: testUser._id,
      timeline: [{ status: "closed", title: "Closed", description: "Done", timestamp: new Date() }],
    });

    // Test all range branches
    const dailyReport = await reportService.generateReport("daily");
    const weeklyReport = await reportService.generateReport("weekly");
    const monthlyReport = await reportService.generateReport("monthly");
    const yearlyReport = await reportService.generateReport("yearly");

    const csv = reportService.convertToCSV(dailyReport);

    // Cleanup
    await User.findByIdAndDelete(testUser._id);
    await Complaint.deleteMany({ citizen: testUser._id });
    await Department.findByIdAndDelete(deptActive._id);
    await Department.findByIdAndDelete(deptEmpty._id);

    const valid =
      dailyReport.timeframe === "daily" &&
      weeklyReport.timeframe === "weekly" &&
      monthlyReport.timeframe === "monthly" &&
      yearlyReport.timeframe === "yearly" &&
      dailyReport.summary.pendingCount >= 1 &&
      dailyReport.summary.inProgressCount >= 1 &&
      dailyReport.summary.resolvedCount >= 1 &&
      dailyReport.summary.closedCount >= 1 &&
      dailyReport.summary.avgResolutionHours >= 0 &&
      dailyReport.aiStats.avgConfidence > 0 &&
      dailyReport.aiStats.duplicateCount >= 1 &&
      csv.includes("--- SUMMARY STATISTICS ---") &&
      csv.includes("--- DEPARTMENT PERFORMANCE ---");

    return valid;
  });

const runAiChatServiceTests = (isDbConnected: boolean) =>
  executeTest("AIChatService full branch & role coverage", async () => {
    if (!isDbConnected) {
      return { passed: true, details: "Skipped (no DB connection)" };
    }

    const testUser = await User.create({
      firstName: "Chat",
      lastName: "Tester",
      email: `chattest_${Date.now()}@test.com`,
      password: "password123",
      role: "citizen",
      isActive: true,
    });

    const citizenPayload = {
      userId: testUser._id.toString(),
      email: testUser.email,
      role: "citizen" as const,
    };

    const officerPayload = {
      userId: testUser._id.toString(),
      email: testUser.email,
      role: "officer" as const,
    };

    const adminPayload = {
      userId: testUser._id.toString(),
      email: testUser.email,
      role: "admin" as const,
    };

    const unknownPayload = {
      userId: testUser._id.toString(),
      email: testUser.email,
      role: "field_worker" as const,
    };

    // 1. Citizen submit guidance
    const resSubmit = await aiChatService.sendMessage(
      citizenPayload,
      undefined,
      "How do I submit a report?",
    );

    // 2. Citizen status with no complaints
    const resStatusEmpty = await aiChatService.sendMessage(
      citizenPayload,
      resSubmit.conversation._id.toString(),
      "What is my complaint status?",
    );

    // Create a complaint for status lookup
    const testComplaint = await Complaint.create({
      title: "Broken streetlight on main ave",
      description: "Light bulb broken and street dark",
      category: "Streetlight Issue",
      location: { latitude: 12.97, longitude: 77.59, address: "Main Ave" },
      status: "submitted",
      citizen: testUser._id,
      aiAnalysis: {
        category: "Streetlight Issue",
        priority: "medium",
        department: "Electricity Board",
        duplicateDetected: false,
        summary: "Broken light",
        confidenceScore: 90,
      },
      timeline: [
        {
          status: "submitted",
          title: "Submitted",
          description: "Ticket registered",
          timestamp: new Date(),
        },
      ],
    });

    // 3. Citizen status with complaints
    const resStatus = await aiChatService.sendMessage(
      citizenPayload,
      resSubmit.conversation._id.toString(),
      "my tickets",
    );

    // 4. Citizen ticket details lookup by ID
    const resTicketDetails = await aiChatService.sendMessage(
      citizenPayload,
      resSubmit.conversation._id.toString(),
      testComplaint._id.toString(),
    );

    // 5. Citizen ticket not found
    const resTicketNotFound = await aiChatService.sendMessage(
      citizenPayload,
      resSubmit.conversation._id.toString(),
      "000000000000000000000000",
    );

    // 6. Citizen department profiles
    await Department.deleteMany({ name: "Electricity Board" });
    await Department.create({
      name: "Electricity Board",
      description: "Handles power and streetlights",
      contactInfo: "555-POWER",
      status: "active",
    });
    const resDept = await aiChatService.sendMessage(
      citizenPayload,
      resSubmit.conversation._id.toString(),
      "who handles streetlights department",
    );

    // 7. Citizen default response
    const resCitizenDefault = await aiChatService.sendMessage(
      citizenPayload,
      resSubmit.conversation._id.toString(),
      "hello there",
    );

    // 8. Staff / Officer ticket lookup
    const resStaffTicket = await aiChatService.sendMessage(
      officerPayload,
      undefined,
      testComplaint._id.toString(),
    );

    // 9. Staff ticket not found
    const resStaffNotFound = await aiChatService.sendMessage(
      officerPayload,
      resStaffTicket.conversation._id.toString(),
      "111111111111111111111111",
    );

    // 10. Admin analytics guide
    const resAdminAnalytics = await aiChatService.sendMessage(
      adminPayload,
      undefined,
      "show me system info analytics stats",
    );

    // 11. Staff default response
    const resOfficerDefault = await aiChatService.sendMessage(
      officerPayload,
      resStaffTicket.conversation._id.toString(),
      "hi officer bot",
    );

    // 12. Default unknown role response
    const resUnknownDefault = await aiChatService.sendMessage(
      unknownPayload,
      undefined,
      "hello guest",
    );

    // 13. getConversations & getConversationById & deleteAllConversations
    const convList = await aiChatService.getConversations(
      testUser._id.toString(),
    );
    const convById = await aiChatService.getConversationById(
      testUser._id.toString(),
      resSubmit.conversation._id.toString(),
    );

    let notFoundErrorThrown = false;
    try {
      await aiChatService.getConversationById(
        testUser._id.toString(),
        "222222222222222222222222",
      );
    } catch (e) {
      notFoundErrorThrown = true;
    }

    await aiChatService.deleteAllConversations(testUser._id.toString());
    const emptyConvList = await aiChatService.getConversations(
      testUser._id.toString(),
    );

    // Cleanup
    await User.findByIdAndDelete(testUser._id);
    await Complaint.findByIdAndDelete(testComplaint._id);
    await Department.deleteMany({ name: "Electricity Board" });

    return (
      resSubmit.reply.includes("wizard") &&
      resStatusEmpty.reply.includes("haven't submitted") &&
      resStatus.reply.includes("Broken streetlight") &&
      resTicketDetails.reply.includes("Broken streetlight") &&
      resTicketNotFound.reply.includes("couldn't find") &&
      resDept.reply.includes("Electricity Board") &&
      resCitizenDefault.reply.includes("CivicPulse AI assistant") &&
      resStaffTicket.reply.includes("INTERNAL RETAIL SHEET") &&
      resStaffNotFound.reply.includes("check the hex identifier") &&
      resAdminAnalytics.reply.includes("Diagnostics Guide") &&
      resOfficerDefault.reply.includes("Welcome, Officer") &&
      resUnknownDefault.reply.toLowerCase().includes("how can i assist") &&
      convList.length > 0 &&
      convById._id.toString() === resSubmit.conversation._id.toString() &&
      notFoundErrorThrown &&
      emptyConvList.length === 0
    );
  });

const runAuditServiceTests = (isDbConnected: boolean) =>
  executeTest(
    "AuditService log, catch-block error handling & getAuditLogs options",
    async () => {
      if (isDbConnected) {
        await auditService.log({
          actorId: new mongoose.Types.ObjectId().toString(),
          actorEmail: "audit@test.com",
          actorRole: "admin",
          action: "TEST_AUDIT_ACTION",
          target: "System",
          details: { test: true },
        });

        const res = await auditService.getAuditLogs({
          action: "TEST_AUDIT_ACTION",
          role: "admin",
          target: "System",
          search: "audit",
          sortField: "timestamp",
          sortOrder: "desc",
          page: 1,
          limit: 5,
        });

        if (!res.logs || typeof res.total !== "number") {
          return false;
        }
      }

      // Failure path to test catch (err) block in auditService.log
      const originalError = console.error;
      let consoleErrorCalled = false;
      let consoleErrorArgs: any[] = [];
      console.error = (...args: any[]) => {
        consoleErrorCalled = true;
        consoleErrorArgs = args;
      };

      const originalCreate = auditLogRepository.create;
      auditLogRepository.create = async () => {
        throw new Error("Audit DB error simulation");
      };

      try {
        await auditService.log({
          action: "FAIL_ACTION",
        });
      } finally {
        auditLogRepository.create = originalCreate;
        console.error = originalError;
      }

      return (
        consoleErrorCalled &&
        consoleErrorArgs[0] === "Failed to write audit log:" &&
        consoleErrorArgs[1] instanceof Error &&
        consoleErrorArgs[1].message === "Audit DB error simulation"
      );
    },
  );

const runLoggerTests = () =>
  executeTest(
    "Winston Logger Formatter & Stack Trace Serialization",
    async () => {
      const LEVEL = Symbol.for("level");
      const MESSAGE = Symbol.for("message");

      // 1. consoleFormat without stack
      const consoleNoStackInfo: any = {
        level: "info",
        message: "Test message",
        [LEVEL]: "info",
      };
      const consoleNoStackRes = consoleFormat.transform(consoleNoStackInfo) as any;
      const consoleNoStackMsg = consoleNoStackRes[MESSAGE] || "";
      const consoleNoStackValid =
        consoleNoStackMsg.includes("info") &&
        consoleNoStackMsg.includes("Test message") &&
        !consoleNoStackMsg.includes("undefined") &&
        !consoleNoStackMsg.includes("[object Object]");

      // 2. consoleFormat with string stack
      const consoleStringStackInfo: any = {
        level: "error",
        message: "An error occurred",
        stack: "Error: Something went wrong\n    at Test.fn",
        [LEVEL]: "error",
      };
      const consoleStringStackRes = consoleFormat.transform(
        consoleStringStackInfo,
      ) as any;
      const consoleStringStackMsg = consoleStringStackRes[MESSAGE] || "";
      const consoleStringStackValid =
        consoleStringStackMsg.includes("error") &&
        consoleStringStackMsg.includes("An error occurred") &&
        consoleStringStackMsg.includes("Error: Something went wrong\n    at Test.fn");

      // 3. consoleFormat with object stack
      const consoleObjStackInfo: any = {
        level: "error",
        message: "Object error",
        stack: { code: 500, detail: "Internal error" },
        [LEVEL]: "error",
      };
      const consoleObjStackRes = consoleFormat.transform(
        consoleObjStackInfo,
      ) as any;
      const consoleObjStackMsg = consoleObjStackRes[MESSAGE] || "";
      const consoleObjStackValid =
        consoleObjStackMsg.includes("error") &&
        consoleObjStackMsg.includes("Object error") &&
        consoleObjStackMsg.includes('{"code":500,"detail":"Internal error"}') &&
        !consoleObjStackMsg.includes("[object Object]");

      // 4. logFormat without stack
      const logNoStackInfo: any = {
        level: "info",
        message: "Log message",
        service: "test-service",
        [LEVEL]: "info",
      };
      const logNoStackRes = logFormat.transform(logNoStackInfo) as any;
      const logNoStackMsg = logNoStackRes[MESSAGE] || "";
      const logNoStackValid =
        logNoStackMsg.includes("INFO: Log message") &&
        logNoStackMsg.includes('{"service":"test-service"}') &&
        !logNoStackMsg.includes("[object Object]");

      // 5. logFormat with string stack
      const logStringStackInfo: any = {
        level: "error",
        message: "File log error",
        stack: "Error: File read failure\n    at fs.js",
        [LEVEL]: "error",
      };
      const logStringStackRes = logFormat.transform(logStringStackInfo) as any;
      const logStringStackMsg = logStringStackRes[MESSAGE] || "";
      const logStringStackValid =
        logStringStackMsg.includes("ERROR: File log error") &&
        logStringStackMsg.includes("Error: File read failure\n    at fs.js");

      // 6. logFormat with object stack
      const logObjStackInfo: any = {
        level: "error",
        message: "File log obj error",
        stack: { errorId: "ERR_123" },
        [LEVEL]: "error",
      };
      const logObjStackRes = logFormat.transform(logObjStackInfo) as any;
      const logObjStackMsg = logObjStackRes[MESSAGE] || "";
      const logObjStackValid =
        logObjStackMsg.includes('{"errorId":"ERR_123"}') &&
        !logObjStackMsg.includes("[object Object]");

      // 7. Verify main logger methods execution
      logger.info("Logger test execution verified");
      logger.error("Logger test error with stack", { stack: "Error: test" });

      return (
        consoleNoStackValid &&
        consoleStringStackValid &&
        consoleObjStackValid &&
        logNoStackValid &&
        logStringStackValid &&
        logObjStackValid
      );
    },
  );

const runTests = async () => {
  let isDbConnected = false;
  try {
    isDbConnected = await connectTestDatabase();
  } catch (err: any) {
    console.error(err.message);
    process.exit(1);
  }

  try {
    await runPasswordTests();
    await runJwtTests();
    await runAiClassificationTests();
    await runCacheTests();
    await runSecurityMiddlewareTests();
    await runExtendedAiTests();
    await runAdminControllerTests();
    await runDatabaseServiceTests(isDbConnected);
    await runReportServiceTests(isDbConnected);
    await runAiChatServiceTests(isDbConnected);
    await runAuditServiceTests(isDbConnected);
    await runLoggerTests();
    await runDepartmentAndNotificationTests();
    await runAdminDashboardAndUserMgmtTests();
    await runFieldWorkerAndOfficerTests();
    await runRepositoriesAndAiWorkflowTests();
    await runAdminControllerFullTests();

    console.log("\n🌟 Integration Test Suite finished.");
  } finally {
    await disconnectTestDatabase(isDbConnected);
  }
};

runTests();
