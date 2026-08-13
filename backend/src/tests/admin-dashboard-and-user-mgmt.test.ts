import mongoose from "mongoose";
import User from "../models/user.model";
import Complaint from "../models/complaint.model";
import Department from "../models/department.model";
import { adminDashboardService } from "../modules/admin/services/admin-dashboard.service";
import { userManagementService } from "../modules/admin/services/user-management.service";
import { TokenPayload } from "../utils/jwt.util";

export const runAdminDashboardAndUserMgmtTests = async () => {
  console.log("🧪 Running Admin Dashboard & User Management Service Tests...");

  // Clean test data
  await User.deleteMany({ email: /^adm_mgmt_test_/ });
  await Complaint.deleteMany({ title: /^\[TEST_ADM_DASH\]/ });
  await Department.deleteMany({ name: /^Test_Adm_Dept_/ });

  // Create real admin user in database
  const adminUser = await User.create({
    firstName: "Admin",
    lastName: "Test",
    email: `adm_mgmt_test_admin_${Date.now()}@test.com`,
    password: "hashed_password_123",
    role: "admin",
    isActive: true,
  });

  const mockAdmin: TokenPayload = {
    userId: adminUser._id.toString(),
    email: adminUser.email,
    role: "admin",
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Admin Dashboard Service Tests
  // ───────────────────────────────────────────────────────────────────────────

  // 1.1 Overview Stats
  const overviewStats = await adminDashboardService.getOverviewStats();
  if (
    typeof overviewStats.totalUsers !== "number" ||
    typeof overviewStats.totalComplaints !== "number" ||
    typeof overviewStats.totalDepartments !== "number"
  ) {
    throw new Error("getOverviewStats failed to return numeric metrics");
  }

  // Create a complaint with aiAnalysis to test realAvgConf aggregation branch
  const testUser = await User.create({
    firstName: "AdmMgmt",
    lastName: "User",
    email: `adm_mgmt_test_${Date.now()}@test.com`,
    password: "hashed_password_123",
    role: "citizen",
    isActive: true,
  });

  await Complaint.create({
    title: "[TEST_ADM_DASH] AI Complaint",
    description: "Testing AI metrics in dashboard",
    category: "Road Damage",
    department: "Public Works Department (PWD)",
    status: "submitted",
    citizen: testUser._id,
    location: { latitude: 12.97, longitude: 77.59, address: "Test Location" },
    aiAnalysis: {
      category: "Road Damage",
      priority: "high",
      department: "PWD",
      duplicateDetected: false,
      summary: "Pothole issue",
      confidenceScore: 92,
    },
  });

  // 1.2 Analytics Overview (Trends, AI Metrics, Heatmap)
  const analytics = await adminDashboardService.getAnalyticsOverview();
  if (
    !Array.isArray(analytics.trends) ||
    analytics.trends.length !== 6 ||
    typeof analytics.aiMetrics.averageConfidence !== "number" ||
    !Array.isArray(analytics.heatmap)
  ) {
    throw new Error("getAnalyticsOverview failed");
  }


  // ───────────────────────────────────────────────────────────────────────────
  // 2. User Management Service Tests
  // ───────────────────────────────────────────────────────────────────────────

  // 2.1 getUsers - Search, Role, Active, Locked, Pagination, Sorting
  const officerUser = await User.create({
    firstName: "TargetOfficer",
    lastName: "Searchable",
    email: `adm_mgmt_test_officer_${Date.now()}@test.com`,
    password: "hashed_password_123",
    role: "officer",
    isActive: true,
    isLocked: false,
    phone: "9876543210",
  });

  const lockedUser = await User.create({
    firstName: "Locked",
    lastName: "User",
    email: `adm_mgmt_test_locked_${Date.now()}@test.com`,
    password: "hashed_password_123",
    role: "citizen",
    isActive: false,
    isLocked: true,
  });

  if (!lockedUser._id) throw new Error("Failed to create lockedUser");

  // Query with all option branches
  const resFiltered = await userManagementService.getUsers({
    role: "officer",
    isActive: true,
    isLocked: false,
    search: "TargetOfficer",
    page: 1,
    limit: 5,
    sortField: "createdAt",
    sortOrder: "asc",
  });
  if (!resFiltered.users || resFiltered.users.length === 0) {
    throw new Error("getUsers with filters failed to return matched user");
  }

  // Query locked user
  const resLocked = await userManagementService.getUsers({
    isLocked: true,
    isActive: false,
    search: "Locked",
  });
  if (!resLocked.users || resLocked.users.length === 0) {
    throw new Error("getUsers for locked user failed");
  }

  // 2.2 setUserActiveState - Success & Self-Deactivation Error
  let selfDeactivateErr = false;
  try {
    await userManagementService.setUserActiveState(mockAdmin, mockAdmin.userId, false);
  } catch (err: any) {
    if (err.statusCode === 400) selfDeactivateErr = true;
  }
  if (!selfDeactivateErr) throw new Error("setUserActiveState expected error when admin deactivates self");

  let notFoundUserErr = false;
  try {
    await userManagementService.setUserActiveState(mockAdmin, new mongoose.Types.ObjectId().toString(), false);
  } catch (err: any) {
    if (err.statusCode === 404) notFoundUserErr = true;
  }
  if (!notFoundUserErr) throw new Error("setUserActiveState expected notFound error");

  const deactivatedUser = await userManagementService.setUserActiveState(
    mockAdmin,
    officerUser._id.toString(),
    false,
    "127.0.0.1",
    "TestAgent",
  );
  if (deactivatedUser.isActive !== false) throw new Error("setUserActiveState failed");

  // Re-activate
  const reactivatedUser = await userManagementService.setUserActiveState(
    mockAdmin,
    officerUser._id.toString(),
    true,
  );
  if (reactivatedUser.isActive !== true) throw new Error("setUserActiveState re-activation failed");

  // 2.3 setUserLockState - Success & Self-Lock Error
  let selfLockErr = false;
  try {
    await userManagementService.setUserLockState(mockAdmin, mockAdmin.userId, true);
  } catch (err: any) {
    if (err.statusCode === 400) selfLockErr = true;
  }
  if (!selfLockErr) throw new Error("setUserLockState expected error when admin locks self");

  let lockNotFoundErr = false;
  try {
    await userManagementService.setUserLockState(mockAdmin, new mongoose.Types.ObjectId().toString(), true);
  } catch (err: any) {
    if (err.statusCode === 404) lockNotFoundErr = true;
  }
  if (!lockNotFoundErr) throw new Error("setUserLockState expected notFound error");

  const lockedRes = await userManagementService.setUserLockState(
    mockAdmin,
    officerUser._id.toString(),
    true,
    "127.0.0.1",
    "TestAgent",
  );
  if (lockedRes.isLocked !== true) throw new Error("setUserLockState failed");

  const unlockedRes = await userManagementService.setUserLockState(
    mockAdmin,
    officerUser._id.toString(),
    false,
  );
  if (unlockedRes.isLocked !== false) throw new Error("setUserLockState unlock failed");

  // 2.4 resetUserPasswordByAdmin - Success & Error paths
  let resetNotFoundErr = false;
  try {
    await userManagementService.resetUserPasswordByAdmin(mockAdmin, new mongoose.Types.ObjectId().toString());
  } catch (err: any) {
    if (err.statusCode === 404) resetNotFoundErr = true;
  }
  if (!resetNotFoundErr) throw new Error("resetUserPasswordByAdmin expected notFound error");

  // Test missing DEFAULT_PASSWORD branch
  const originalEnvPass = process.env["DEFAULT_PASSWORD"];
  delete process.env["DEFAULT_PASSWORD"];

  let missingEnvPassErr = false;
  try {
    await userManagementService.resetUserPasswordByAdmin(mockAdmin, officerUser._id.toString());
  } catch (err: any) {
    if (err.statusCode === 500) missingEnvPassErr = true;
  }
  if (!missingEnvPassErr) throw new Error("resetUserPasswordByAdmin expected 500 when DEFAULT_PASSWORD is unset");

  // Restore DEFAULT_PASSWORD and perform success reset
  process.env["DEFAULT_PASSWORD"] = "CivicPulseTempPass123!";
  const resetResult = await userManagementService.resetUserPasswordByAdmin(
    mockAdmin,
    officerUser._id.toString(),
    "127.0.0.1",
    "TestAgent",
  );
  if (resetResult !== "CivicPulseTempPass123!") throw new Error("resetUserPasswordByAdmin failed");

  // Restore env if it was previously defined
  if (originalEnvPass) {
    process.env["DEFAULT_PASSWORD"] = originalEnvPass;
  }

  console.log("✅ Admin Dashboard & User Management Service Tests PASSED cleanly!");
  return true;
};
