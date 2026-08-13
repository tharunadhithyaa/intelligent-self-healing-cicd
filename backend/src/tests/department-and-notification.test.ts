import mongoose from "mongoose";
import Department from "../models/department.model";
import User from "../models/user.model";
import Notification from "../models/notification.model";
import Complaint from "../models/complaint.model";
import { departmentService } from "../modules/admin/services/department.service";
import { notificationService } from "../modules/admin/services/notification.service";
import { TokenPayload } from "../utils/jwt.util";

const mockAdmin: TokenPayload = {
  userId: new mongoose.Types.ObjectId().toString(),
  email: "admin_test@test.com",
  role: "admin",
};

export const runDepartmentAndNotificationTests = async () => {
  console.log("🧪 Running Department & Notification Service Tests...");

  // Clean up relevant test documents first
  await Department.deleteMany({ name: /^Test_Dept_/ });
  await User.deleteMany({ email: /^dept_notif_test_/ });
  await Notification.deleteMany({});

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Department Service Tests
  // ───────────────────────────────────────────────────────────────────────────

  // 1.1 createDepartment - Success & Conflict
  const deptName = `Test_Dept_${Date.now()}`;
  const dept1 = await departmentService.createDepartment(
    mockAdmin,
    deptName,
    "Test department description",
    "contact@test.com",
    "127.0.0.1",
    "TestAgent",
  );

  if (!dept1 || dept1.name !== deptName) {
    throw new Error("createDepartment failed to create department");
  }

  // Duplicate name -> Conflict Error
  let createConflictError = false;
  try {
    await departmentService.createDepartment(
      mockAdmin,
      deptName,
      "Duplicate",
      "contact@test.com",
    );
  } catch (err: any) {
    if (err.statusCode === 409) {
      createConflictError = true;
    }
  }
  if (!createConflictError) throw new Error("createDepartment expected conflict error on duplicate name");

  // 1.2 getDepartments - Cache Miss & Cache Hit
  const deptsFirst = await departmentService.getDepartments();
  if (!deptsFirst || deptsFirst.length === 0) throw new Error("getDepartments returned empty list");

  const deptsCached = await departmentService.getDepartments();
  if (deptsCached.length !== deptsFirst.length) throw new Error("getDepartments cache mismatch");

  // 1.3 updateDepartment - NotFound, NameConflict & Success
  let updateNotFound = false;
  try {
    await departmentService.updateDepartment(mockAdmin, new mongoose.Types.ObjectId().toString(), {
      name: "Nonexistent",
      description: "Desc",
      contactInfo: "Info",
      status: "active",
    });
  } catch (err: any) {
    if (err.statusCode === 444 || err.statusCode === 404) updateNotFound = true;
  }
  if (!updateNotFound) throw new Error("updateDepartment expected notFound error");

  // Create a 2nd department to test conflict when updating name
  const deptName2 = `Test_Dept_2_${Date.now()}`;
  const dept2 = await departmentService.createDepartment(
    mockAdmin,
    deptName2,
    "Second dept",
    "contact2@test.com",
  );

  let updateConflict = false;
  try {
    await departmentService.updateDepartment(mockAdmin, dept2._id.toString(), {
      name: deptName, // existing name of dept1
      description: "Conflict update",
      contactInfo: "contact@test.com",
      status: "active",
    });
  } catch (err: any) {
    if (err.statusCode === 409) updateConflict = true;
  }
  if (!updateConflict) throw new Error("updateDepartment expected conflict error");

  // Successful update
  const updatedDept1 = await departmentService.updateDepartment(mockAdmin, dept1._id.toString(), {
    name: dept1.name,
    description: "Updated Description",
    contactInfo: "updated@test.com",
    status: "active",
  });
  if (updatedDept1.description !== "Updated Description") throw new Error("updateDepartment failed");

  // 1.4 assignOfficer & removeOfficer
  // Create an officer user & a citizen user
  const officerUser = await User.create({
    firstName: "Dept",
    lastName: "Officer",
    email: `dept_notif_test_officer_${Date.now()}@test.com`,
    password: "hashed_pass",
    role: "officer",
    status: "active",
  });

  const citizenUser = await User.create({
    firstName: "Dept",
    lastName: "Citizen",
    email: `dept_notif_test_citizen_${Date.now()}@test.com`,
    password: "hashed_pass",
    role: "citizen",
    status: "active",
  });

  // Assign officer: invalid role error
  let assignRoleErr = false;
  try {
    await departmentService.assignOfficer(mockAdmin, dept1._id.toString(), citizenUser._id.toString());
  } catch (err: any) {
    if (err.statusCode === 400) assignRoleErr = true;
  }
  if (!assignRoleErr) throw new Error("assignOfficer expected invalid role error");

  // Assign officer: not found dept/officer errors
  let assignDeptNotFound = false;
  try {
    await departmentService.assignOfficer(mockAdmin, new mongoose.Types.ObjectId().toString(), officerUser._id.toString());
  } catch (err: any) {
    if (err.statusCode === 404) assignDeptNotFound = true;
  }
  if (!assignDeptNotFound) throw new Error("assignOfficer expected dept not found");

  let assignOfficerNotFound = false;
  try {
    await departmentService.assignOfficer(mockAdmin, dept1._id.toString(), new mongoose.Types.ObjectId().toString());
  } catch (err: any) {
    if (err.statusCode === 404) assignOfficerNotFound = true;
  }
  if (!assignOfficerNotFound) throw new Error("assignOfficer expected officer not found");

  // Successful assign
  const deptWithOfficer = await departmentService.assignOfficer(mockAdmin, dept1._id.toString(), officerUser._id.toString());
  if (deptWithOfficer.officers.length !== 1) throw new Error("assignOfficer failed");

  // Duplicate assign (idempotent branch)
  const deptWithOfficerDup = await departmentService.assignOfficer(mockAdmin, dept1._id.toString(), officerUser._id.toString());
  if (deptWithOfficerDup.officers.length !== 1) throw new Error("assignOfficer duplicate idempotent failed");

  // removeOfficer: department not found error
  let removeDeptNotFound = false;
  try {
    await departmentService.removeOfficer(mockAdmin, new mongoose.Types.ObjectId().toString(), officerUser._id.toString());
  } catch (err: any) {
    if (err.statusCode === 404) removeDeptNotFound = true;
  }
  if (!removeDeptNotFound) throw new Error("removeOfficer expected dept not found");

  // removeOfficer: officer not in dept (idempotent return)
  const nonAssignedOfficer = await User.create({
    firstName: "Other",
    lastName: "Officer",
    email: `dept_notif_test_other_${Date.now()}@test.com`,
    password: "hashed_pass",
    role: "officer",
    status: "active",
  });
  const deptUnchanged = await departmentService.removeOfficer(mockAdmin, dept1._id.toString(), nonAssignedOfficer._id.toString());
  if (deptUnchanged.officers.length !== 1) throw new Error("removeOfficer idempotent return failed");

  // Successful removeOfficer
  const deptAfterRemove = await departmentService.removeOfficer(mockAdmin, dept1._id.toString(), officerUser._id.toString());
  if (deptAfterRemove.officers.length !== 0) throw new Error("removeOfficer failed");

  // 1.5 deleteDepartment
  // Delete department with active complaints error branch
  await Complaint.create({
    title: "[TEST] Active complaint for dept test",
    description: "Testing dept deletion block",
    category: "Road Damage",
    department: dept2.name,
    status: "submitted",
    citizen: citizenUser._id,
    location: { latitude: 10, longitude: 10, address: "Test Location" },
  });

  let deleteWithComplaintsErr = false;
  try {
    await departmentService.deleteDepartment(mockAdmin, dept2._id.toString());
  } catch (err: any) {
    if (err.statusCode === 400) deleteWithComplaintsErr = true;
  }
  if (!deleteWithComplaintsErr) throw new Error("deleteDepartment expected active complaints error");

  // Delete department not found
  let deleteNotFound = false;
  try {
    await departmentService.deleteDepartment(mockAdmin, new mongoose.Types.ObjectId().toString());
  } catch (err: any) {
    if (err.statusCode === 404) deleteNotFound = true;
  }
  if (!deleteNotFound) throw new Error("deleteDepartment expected not found error");

  // Delete dept1 successfully
  await departmentService.deleteDepartment(mockAdmin, dept1._id.toString());


  // ───────────────────────────────────────────────────────────────────────────
  // 2. Notification Service Tests
  // ───────────────────────────────────────────────────────────────────────────

  // 2.1 sendNotification - User not found
  const notifNull = await notificationService.sendNotification(
    new mongoose.Types.ObjectId().toString(),
    "status_update",
    "Title",
    "Message",
  );
  if (notifNull !== null) throw new Error("sendNotification expected null for invalid recipient");

  // User with notification preferences disabled
  const userDisabledPrefs = await User.create({
    firstName: "No",
    lastName: "Notif",
    email: `dept_notif_test_noprefs_${Date.now()}@test.com`,
    password: "hashed_password_123",
    role: "citizen",
    settings: {
      notifications: {
        email: false,
        push: false,
        sms: false,
        complaints: false,
        system: false,
      },
    },
  });

  // Prefs block status_update
  const notifBlockedStatus = await notificationService.sendNotification(
    userDisabledPrefs._id.toString(),
    "status_update",
    "Blocked Status",
    "Blocked Message",
  );
  if (notifBlockedStatus !== null) throw new Error("sendNotification expected null when complaints preference is false");

  // Prefs block system_alert / announcement
  const notifBlockedSystem = await notificationService.sendNotification(
    userDisabledPrefs._id.toString(),
    "system_alert",
    "Blocked System",
    "Blocked Message",
  );
  if (notifBlockedSystem !== null) throw new Error("sendNotification expected null when system preference is false");

  // Success sendNotification
  const notifSent = await notificationService.sendNotification(
    citizenUser._id.toString(),
    "status_update",
    "Status Changed",
    "Your complaint is verified",
    "relatedEntity123",
  );
  if (!notifSent || notifSent.title !== "Status Changed") throw new Error("sendNotification failed to create notification");

  // 2.2 broadcastAnnouncement
  await notificationService.broadcastAnnouncement(
    mockAdmin,
    ["citizen", "officer"],
    "Global Maintenance",
    "System will undergo maintenance tonight",
    "127.0.0.1",
    "TestAgent",
  );

  // Broadcast to all users (empty targetRoles)
  await notificationService.broadcastAnnouncement(
    mockAdmin,
    [],
    "All Users Announcement",
    "Broadcasting to everyone",
  );

  // 2.3 getUserNotifications
  const userNotifs = await notificationService.getUserNotifications(citizenUser._id.toString());
  if (!Array.isArray(userNotifs) || userNotifs.length === 0) throw new Error("getUserNotifications failed");

  // 2.4 markNotificationAsRead & Errors
  let markNotFoundErr = false;
  try {
    await notificationService.markNotificationAsRead(
      citizenUser._id.toString(),
      new mongoose.Types.ObjectId().toString(),
    );
  } catch (err: any) {
    if (err.statusCode === 404) markNotFoundErr = true;
  }
  if (!markNotFoundErr) throw new Error("markNotificationAsRead expected 404 not found");

  const readNotif = await notificationService.markNotificationAsRead(
    citizenUser._id.toString(),
    notifSent._id.toString(),
  );
  if (!readNotif.isRead) throw new Error("markNotificationAsRead failed to mark as read");

  // 2.5 markAllAsRead
  await notificationService.markAllAsRead(citizenUser._id.toString());

  // 2.6 deleteNotification & Errors
  let deleteNotifNotFoundErr = false;
  try {
    await notificationService.deleteNotification(
      citizenUser._id.toString(),
      new mongoose.Types.ObjectId().toString(),
    );
  } catch (err: any) {
    if (err.statusCode === 404) deleteNotifNotFoundErr = true;
  }
  if (!deleteNotifNotFoundErr) throw new Error("deleteNotification expected 404 not found");

  await notificationService.deleteNotification(
    citizenUser._id.toString(),
    notifSent._id.toString(),
  );

  console.log("✅ Department & Notification Service Tests PASSED cleanly!");
  return true;
};
