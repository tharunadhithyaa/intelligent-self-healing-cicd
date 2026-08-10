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

    const report = await reportService.generateReport("daily");
    const csv = reportService.convertToCSV(report);

    const validStructure =
      report.timeframe === "daily" &&
      typeof report.summary.totalComplaints === "number" &&
      csv.includes("CivicPulse Administrative Summary Report (DAILY)") &&
      csv.includes("--- SUMMARY STATISTICS ---") &&
      csv.includes("--- DEPARTMENT PERFORMANCE ---");

    return validStructure;
  });

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

    console.log("\n🌟 Integration Test Suite finished.");
  } finally {
    await disconnectTestDatabase(isDbConnected);
  }
};

runTests();
