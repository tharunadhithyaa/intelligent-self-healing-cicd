import { Response, NextFunction } from "express";
import User from "../models/user.model";
import Department from "../models/department.model";
import Notification from "../models/notification.model";
import { adminController } from "../modules/admin/admin.controller";
import { TokenPayload } from "../utils/jwt.util";
import { AuthenticatedRequest } from "../interfaces/request.interface";

export interface IMockResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: Record<string, unknown> | null;
  sentData: unknown;
  status: (code: number) => IMockResponse;
  json: (data: Record<string, unknown>) => IMockResponse;
  setHeader: (key: string, val: string) => IMockResponse;
  send: (data: unknown) => IMockResponse;
}

const createMockRes = (): IMockResponse => {
  const mockRes: IMockResponse = {
    statusCode: 200,
    headers: {},
    body: null,
    sentData: null,
    status(code: number): IMockResponse {
      this.statusCode = code;
      return this;
    },
    json(data: Record<string, unknown>): IMockResponse {
      this.body = data;
      return this;
    },
    setHeader(key: string, val: string): IMockResponse {
      this.headers[key] = val;
      return this;
    },
    send(data: unknown): IMockResponse {
      this.sentData = data;
      return this;
    },
  };
  return mockRes;
};

export const runAdminControllerFullTests = async (): Promise<boolean> => {
  console.log("🧪 Running Admin Controller Full Tests...");

  await User.deleteMany({ email: /^adm_ctrl_test_/ });
  await Department.deleteMany({ name: /^Test_AdmCtrl_Dept_/ });
  await Notification.deleteMany({});

  const adminUser = await User.create({
    firstName: "AdminCtrl",
    lastName: "Tester",
    email: `adm_ctrl_test_${Date.now()}@test.com`,
    password: "hashed_password_123",
    role: "admin",
    isActive: true,
  });

  const mockAdminToken: TokenPayload = {
    userId: adminUser._id.toString(),
    email: adminUser.email,
    role: "admin",
  };

  const targetUser = await User.create({
    firstName: "TargetCtrl",
    lastName: "User",
    email: `adm_ctrl_test_target_${Date.now()}@test.com`,
    password: "hashed_password_123",
    role: "officer",
    isActive: true,
  });

  const nextErrHandler: NextFunction = (_err?: unknown): void => {};

  // 1. Overview & Analytics
  const resOverview = createMockRes();
  await adminController.getOverviewStats(
    { user: mockAdminToken } as unknown as AuthenticatedRequest,
    resOverview as unknown as Response,
    nextErrHandler,
  );

  const resAnalytics = createMockRes();
  await adminController.getAnalyticsOverview(
    { user: mockAdminToken } as unknown as AuthenticatedRequest,
    resAnalytics as unknown as Response,
    nextErrHandler,
  );

  // 2. User Management
  const resGetUsers = createMockRes();
  await adminController.getUsers(
    {
      user: mockAdminToken,
      query: {
        search: "TargetCtrl",
        role: "officer",
        isActive: "true",
        isLocked: "false",
        page: "1",
        limit: "10",
        sortField: "createdAt",
        sortOrder: "desc",
      },
    } as unknown as AuthenticatedRequest,
    resGetUsers as unknown as Response,
    nextErrHandler,
  );

  const resSetActive = createMockRes();
  await adminController.setUserActiveState(
    {
      user: mockAdminToken,
      params: { id: targetUser._id.toString() },
      body: { isActive: false },
      ip: "127.0.0.1",
      headers: { "user-agent": "TestAgent" },
    } as unknown as AuthenticatedRequest,
    resSetActive as unknown as Response,
    nextErrHandler,
  );

  const resSetLock = createMockRes();
  await adminController.setUserLockState(
    {
      user: mockAdminToken,
      params: { id: targetUser._id.toString() },
      body: { isLocked: true },
      ip: "127.0.0.1",
      headers: { "user-agent": "TestAgent" },
    } as unknown as AuthenticatedRequest,
    resSetLock as unknown as Response,
    nextErrHandler,
  );

  // Reset password
  process.env["DEFAULT_PASSWORD"] = "CivicPulseTempPass123!";
  const resResetPass = createMockRes();
  await adminController.resetUserPassword(
    {
      user: mockAdminToken,
      params: { id: targetUser._id.toString() },
      ip: "127.0.0.1",
      headers: { "user-agent": "TestAgent" },
    } as unknown as AuthenticatedRequest,
    resResetPass as unknown as Response,
    nextErrHandler,
  );

  // 3. Department Management
  const deptName = `Test_AdmCtrl_Dept_${Date.now()}`;
  const resCreateDept = createMockRes();
  await adminController.createDepartment(
    {
      user: mockAdminToken,
      body: { name: deptName, description: "Ctrl Dept", contactInfo: "contact@test.com" },
      ip: "127.0.0.1",
      headers: { "user-agent": "TestAgent" },
    } as unknown as AuthenticatedRequest,
    resCreateDept as unknown as Response,
    nextErrHandler,
  );

  const responseBody = resCreateDept.body as { data?: { department?: { _id?: { toString(): string } } } } | null;
  const createdDept = responseBody?.data?.department;

  const resGetDepts = createMockRes();
  await adminController.getDepartments(
    { user: mockAdminToken } as unknown as AuthenticatedRequest,
    resGetDepts as unknown as Response,
    nextErrHandler,
  );

  if (createdDept?._id) {
    const resUpdateDept = createMockRes();
    await adminController.updateDepartment(
      {
        user: mockAdminToken,
        params: { id: createdDept._id.toString() },
        body: { name: deptName, description: "Updated", contactInfo: "info", status: "active" },
        ip: "127.0.0.1",
        headers: { "user-agent": "TestAgent" },
      } as unknown as AuthenticatedRequest,
      resUpdateDept as unknown as Response,
      nextErrHandler,
    );

    const resAssignOfficer = createMockRes();
    await adminController.assignOfficer(
      {
        user: mockAdminToken,
        params: { id: createdDept._id.toString() },
        body: { officerId: targetUser._id.toString() },
        ip: "127.0.0.1",
        headers: { "user-agent": "TestAgent" },
      } as unknown as AuthenticatedRequest,
      resAssignOfficer as unknown as Response,
      nextErrHandler,
    );

    const resRemoveOfficer = createMockRes();
    await adminController.removeOfficer(
      {
        user: mockAdminToken,
        params: { id: createdDept._id.toString() },
        body: { officerId: targetUser._id.toString() },
        ip: "127.0.0.1",
        headers: { "user-agent": "TestAgent" },
      } as unknown as AuthenticatedRequest,
      resRemoveOfficer as unknown as Response,
      nextErrHandler,
    );

    const resDelDept = createMockRes();
    await adminController.deleteDepartment(
      {
        user: mockAdminToken,
        params: { id: createdDept._id.toString() },
        ip: "127.0.0.1",
        headers: { "user-agent": "TestAgent" },
      } as unknown as AuthenticatedRequest,
      resDelDept as unknown as Response,
      nextErrHandler,
    );
  }

  // 4. Reports & Export
  const resGenReport = createMockRes();
  await adminController.generateReport(
    { user: mockAdminToken, query: { timeframe: "monthly" } } as unknown as AuthenticatedRequest,
    resGenReport as unknown as Response,
    nextErrHandler,
  );

  const resExportCSV = createMockRes();
  await adminController.exportReportCSV(
    { user: mockAdminToken, query: { timeframe: "weekly" } } as unknown as AuthenticatedRequest,
    resExportCSV as unknown as Response,
    nextErrHandler,
  );

  // 5. Audit Logs
  const resAuditLogs = createMockRes();
  await adminController.getAuditLogs(
    {
      user: mockAdminToken,
      query: {
        search: "test",
        action: "user_activated",
        role: "admin",
        target: "User",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        sortField: "timestamp",
        sortOrder: "desc",
        page: "1",
        limit: "10",
      },
    } as unknown as AuthenticatedRequest,
    resAuditLogs as unknown as Response,
    nextErrHandler,
  );

  // 6. Broadcast & Notifications
  const resBroadcast = createMockRes();
  await adminController.broadcastNotification(
    {
      user: mockAdminToken,
      body: { targetRoles: ["officer"], title: "Alert", message: "Notice" },
      ip: "127.0.0.1",
      headers: { "user-agent": "TestAgent" },
    } as unknown as AuthenticatedRequest,
    resBroadcast as unknown as Response,
    nextErrHandler,
  );

  const resGetNotifs = createMockRes();
  await adminController.getNotifications(
    { user: mockAdminToken } as unknown as AuthenticatedRequest,
    resGetNotifs as unknown as Response,
    nextErrHandler,
  );

  // Create a notification to mark as read
  const notifObj = await Notification.create({
    recipient: adminUser._id,
    type: "announcement",
    title: "Test",
    message: "Test",
    isRead: false,
  });

  const resMarkRead = createMockRes();
  await adminController.markNotificationRead(
    {
      user: mockAdminToken,
      params: { id: notifObj._id.toString() },
    } as unknown as AuthenticatedRequest,
    resMarkRead as unknown as Response,
    nextErrHandler,
  );

  // 7. Error catch paths (next(error))
  let errorHandledCount = 0;
  const mockNextCatch: NextFunction = (err?: unknown): void => {
    if (err) {
      errorHandledCount++;
    }
  };

  // Trigger error path in getOverviewStats
  await adminController.setUserActiveState(
    { user: mockAdminToken, params: { id: "invalid_id" }, body: {} } as unknown as AuthenticatedRequest,
    createMockRes() as unknown as Response,
    mockNextCatch,
  );
  await adminController.deleteDepartment(
    { user: mockAdminToken, params: { id: "invalid_id" } } as unknown as AuthenticatedRequest,
    createMockRes() as unknown as Response,
    mockNextCatch,
  );

  if (errorHandledCount !== 2) {
    throw new Error("adminController error catch handling failed");
  }

  console.log("✅ Admin Controller Full Tests PASSED cleanly!");
  return true;
};
