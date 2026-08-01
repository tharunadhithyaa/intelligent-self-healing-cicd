import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/user.model";
import Complaint from "../models/complaint.model";
import Role from "../models/role.model";
import { hashPassword, comparePassword } from "../utils/password.util";
import { generateTokenPair, verifyAccessToken } from "../utils/jwt.util";
import { aiService } from "../modules/complaints/ai.service";
import { apiCache } from "../utils/cache.util";

dotenv.config();

const mongoUri =
  process.env["MONGODB_URI"] || "mongodb://localhost:27017/civicpulse_test";

const logTest = (name: string, passed: boolean, details?: string) => {
  const symbol = passed ? "✅" : "❌";
  const status = passed ? "PASSED" : "FAILED";
  console.log(
    `${symbol} [${status}] - ${name}${details ? ` (${details})` : ""}`,
  );
};

const runTests = async () => {
  console.log("🚀 Starting CivicPulse Production Integration Test Suite...");
  console.log("🔗 Connecting to test MongoDB instance...");

  try {
    await mongoose.connect(mongoUri);
    console.log("Connected successfully. Cleaning up test database...\n");

    // Clean up test data
    await Promise.all([
      User.deleteMany({ email: /@test\.com$/ }),
      Complaint.deleteMany({ title: /\[TEST\]/ }),
      Role.deleteMany({ name: "test_role" }),
    ]);

    // ───── Test 1: Password Hashing ─────
    try {
      const password = "TestSecretPassword@123";
      const hash = await hashPassword(password);
      const isMatch = await comparePassword(password, hash);
      const isMatchWrong = await comparePassword("wrong_password", hash);

      const passed = isMatch && !isMatchWrong;
      logTest("Password Encryption & Comparison", passed);
    } catch (e: any) {
      logTest("Password Encryption & Comparison", false, e.message);
    }

    // ───── Test 2: JWT Tokens ─────
    try {
      const payload = {
        userId: "507f1f77bcf86cd799439011",
        email: "officer@test.com",
        role: "officer",
      };
      const tokens = generateTokenPair(payload);
      const verified = verifyAccessToken(tokens.accessToken);

      const passed =
        verified.email === payload.email && verified.role === payload.role;
      logTest("JWT Sign & Access Verification", passed);
    } catch (e: any) {
      logTest("JWT Sign & Access Verification", false, e.message);
    }

    // ───── Test 3: AI Analysis Logic ─────
    try {
      const text = "potholes on the street near main junction";
      const category = (aiService as any).predictCategory(text);
      const priority = (aiService as any).predictPriority(text);

      const passed = category === "Road Damage" && priority === "medium";
      logTest(
        "AI Keyword Classification & Priority Routing",
        passed,
        `Category: ${category}, Priority: ${priority}`,
      );
    } catch (e: any) {
      logTest("AI Keyword Classification & Priority Routing", false, e.message);
    }

    // ───── Test 4: Dynamic Caching ─────
    try {
      const cacheKey = "test_key";
      const cacheValue = { departments: ["Sanitation", "PWD"] };

      apiCache.set(cacheKey, cacheValue, 1000);
      const fetched = apiCache.get<any>(cacheKey);

      apiCache.delete(cacheKey);
      const fetchedAfterDelete = apiCache.get<any>(cacheKey);

      const passed =
        fetched !== null &&
        fetched.departments[0] === "Sanitation" &&
        fetchedAfterDelete === null;
      logTest("In-Memory SimpleCache Performance & Invalidation", passed);
    } catch (e: any) {
      logTest(
        "In-Memory SimpleCache Performance & Invalidation",
        false,
        e.message,
      );
    }

    // ───── Test 5: Database Operations ─────
    try {
      // 1. Create a User
      const testUser = await User.create({
        firstName: "Test",
        lastName: "User",
        email: "citizen@test.com",
        password: "hashed_password",
        role: "citizen",
        isActive: true,
      });

      // 2. Submit a Complaint
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

      // Cleanup
      await User.findByIdAndDelete(testUser._id);
      await Complaint.findByIdAndDelete(testComplaint._id);

      const passed = userExists && complaintExists;
      logTest("Mongoose Document CRUD Cycle", passed);
    } catch (e: any) {
      logTest("Mongoose Document CRUD Cycle", false, e.message);
    }

    console.log("\n🌟 Integration Test Suite finished.");
  } catch (error: any) {
    console.error("❌ Failed to run integration tests:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected database.");
  }
};

runTests();
