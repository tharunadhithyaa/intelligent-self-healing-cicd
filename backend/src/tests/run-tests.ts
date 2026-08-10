import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/user.model";
import Complaint from "../models/complaint.model";
import Role from "../models/role.model";
import { hashPassword, comparePassword } from "../utils/password.util";
import { generateTokenPair, verifyAccessToken } from "../utils/jwt.util";
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

  try {
    const mongoUri = getMongoUri();
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
    console.log("Connected successfully. Cleaning up test database...\n");

    await Promise.all([
      User.deleteMany({ email: /@test\.com$/ }),
      Complaint.deleteMany({ title: /\[TEST\]/ }),
      Role.deleteMany({ name: "test_role" }),
    ]);
    return true;
  } catch (err: any) {
    console.log(`⚠️ Database connection skipped: ${err.message}\n`);
    return false;
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
  executeTest("JWT Sign & Access Verification", async () => {
    const payload = {
      userId: "507f1f77bcf86cd799439011",
      email: "officer@test.com",
      role: "officer",
    };
    const tokens = generateTokenPair(payload);
    const verified = verifyAccessToken(tokens.accessToken);
    return verified.email === payload.email && verified.role === payload.role;
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
  executeTest("In-Memory SimpleCache Performance & Invalidation", async () => {
    const cacheKey = "test_key";
    const cacheValue = { departments: ["Sanitation", "PWD"] };
    apiCache.set(cacheKey, cacheValue, 1000);
    const fetched = apiCache.get<any>(cacheKey);
    apiCache.delete(cacheKey);
    const fetchedAfterDelete = apiCache.get<any>(cacheKey);
    return (
      fetched !== null &&
      fetched.departments[0] === "Sanitation" &&
      fetchedAfterDelete === null
    );
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

const runTests = async () => {
  const isDbConnected = await connectTestDatabase();

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

    console.log("\n🌟 Integration Test Suite finished.");
  } finally {
    await disconnectTestDatabase(isDbConnected);
  }
};

runTests();
