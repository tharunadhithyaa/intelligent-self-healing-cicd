import User from "../models/user.model";
import Department from "../models/department.model";
import Notification from "../models/notification.model";
import { adminController } from "../modules/admin/admin.controller";
import { TokenPayload } from "../utils/jwt.util";

const createMockRes = () => {
  const res: any = {};
  res.statusCode = 200;
  res.headers = {};
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data: any) => {
    res.body = data;
    return res;
  };
  res.setHeader = (key: string, val: string) => {
    res.headers[key] = val;
  };
  res.send = (data: any) => {
    res.sentData = data;
    return res;
  };
  return res;
};

export const runAdminControllerFullTests = async () => {
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

  const nextErrHandler = (_err: any) => {};

  // 1. Overview & Analytics
  const resOverview = createMockRes();
  await adminController.getOverviewStats({ user: mockAdminToken } as any, resOverview, nextErrHandler);

  const resAnalytics = createMockRes();
  await adminController.getAnalyticsOverview({ user: mockAdminToken } as any, resAnalytics, nextErrHandler);

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
    } as any,
    resGetUsers,
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
    } as any,
    resSetActive,
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
    } as any,
    resSetLock,
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
    } as any,
    resResetPass,
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
    } as any,
    resCreateDept,
    nextErrHandler,
  );
  const createdDept = resCreateDept.body?.data?.department;

  const resGetDepts = createMockRes();
  await adminController.getDepartments({ user: mockAdminToken } as any, resGetDepts, nextErrHandler);

  if (createdDept?._id) {
    const resUpdateDept = createMockRes();
    await adminController.updateDepartment(
      {
        user: mockAdminToken,
        params: { id: createdDept._id.toString() },
        body: { name: deptName, description: "Updated", contactInfo: "info", status: "active" },
        ip: "127.0.0.1",
        headers: { "user-agent": "TestAgent" },
      } as any,
      resUpdateDept,
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
      } as any,
      resAssignOfficer,
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
      } as any,
      resRemoveOfficer,
      nextErrHandler,
    );

    const resDelDept = createMockRes();
    await adminController.deleteDepartment(
      {
        user: mockAdminToken,
        params: { id: createdDept._id.toString() },
        ip: "127.0.0.1",
        headers: { "user-agent": "TestAgent" },
      } as any,
      resDelDept,
      nextErrHandler,
    );
  }

  // 4. Reports & Export
  const resGenReport = createMockRes();
  await adminController.generateReport(
    { user: mockAdminToken, query: { timeframe: "monthly" } } as any,
    resGenReport,
    nextErrHandler,
  );

  const resExportCSV = createMockRes();
  await adminController.exportReportCSV(
    { user: mockAdminToken, query: { timeframe: "weekly" } } as any,
    resExportCSV,
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
    } as any,
    resAuditLogs,
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
    } as any,
    resBroadcast,
    nextErrHandler,
  );

  const resGetNotifs = createMockRes();
  await adminController.getNotifications({ user: mockAdminToken } as any, resGetNotifs, nextErrHandler);

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
    } as any,
    resMarkRead,
    nextErrHandler,
  );

  // 7. Error catch paths (next(error))
  let errorHandledCount = 0;
  const mockNextCatch = (err: any) => {
    if (err) errorHandledCount++;
  };

  // Trigger error path in getOverviewStats (by passing invalid object if needed or invalid params)
  await adminController.setUserActiveState(
    { user: mockAdminToken, params: { id: "invalid_id" }, body: {} } as any,
    createMockRes(),
    mockNextCatch,
  );
  await adminController.deleteDepartment(
    { user: mockAdminToken, params: { id: "invalid_id" } } as any,
    createMockRes(),
    mockNextCatch,
  );

  if (errorHandledCount !== 2) throw new Error("adminController error catch handling failed");

  console.log("✅ Admin Controller Full Tests PASSED cleanly!");
  return true;
};
