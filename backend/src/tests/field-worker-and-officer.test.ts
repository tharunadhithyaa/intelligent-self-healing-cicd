import mongoose from "mongoose";
import User from "../models/user.model";
import Complaint from "../models/complaint.model";
import Department from "../models/department.model";
import { fieldWorkerService } from "../modules/field-worker/field-worker.service";
import { officerService } from "../modules/officer/officer.service";
import { TokenPayload } from "../utils/jwt.util";

export const runFieldWorkerAndOfficerTests = async () => {
  console.log("🧪 Running Field Worker & Officer Service Tests...");

  // Clean test data
  await User.deleteMany({ email: /^fw_off_test_/ });
  await Complaint.deleteMany({ title: /^\[TEST_FW_OFF\]/ });
  await Department.deleteMany({ name: /^Test_FW_OFF_Dept_/ });

  // 1. Create Test Users
  const citizenUser = await User.create({
    firstName: "FWCitizen",
    lastName: "Test",
    email: `fw_off_test_citizen_${Date.now()}@test.com`,
    password: "hashed_password_123",
    role: "citizen",
    isActive: true,
  });

  const officerUser = await User.create({
    firstName: "FWOfficer",
    lastName: "Test",
    email: `fw_off_test_officer_${Date.now()}@test.com`,
    password: "hashed_password_123",
    role: "officer",
    isActive: true,
  });

  const fieldWorkerUser = await User.create({
    firstName: "FWWorker",
    lastName: "Test",
    email: `fw_off_test_worker_${Date.now()}@test.com`,
    password: "hashed_password_123",
    role: "field_worker",
    isActive: true,
  });

  const otherWorkerUser = await User.create({
    firstName: "FWOtherWorker",
    lastName: "Test",
    email: `fw_off_test_other_worker_${Date.now()}@test.com`,
    password: "hashed_password_123",
    role: "field_worker",
    isActive: true,
  });

  // Create Department & Assign Officer + Worker
  const deptName = `Test_FW_OFF_Dept_${Date.now()}`;
  const deptObj = await Department.create({
    name: deptName,
    description: "Department for Field Worker and Officer tests",
    contactInfo: "contact@test.com",
    status: "active",
    officers: [officerUser._id, fieldWorkerUser._id],
  });

  const officerPayload: TokenPayload = {
    userId: officerUser._id.toString(),
    email: officerUser.email,
    role: "officer",
  };

  const workerPayload: TokenPayload = {
    userId: fieldWorkerUser._id.toString(),
    email: fieldWorkerUser.email,
    role: "field_worker",
  };

  const otherWorkerPayload: TokenPayload = {
    userId: otherWorkerUser._id.toString(),
    email: otherWorkerUser.email,
    role: "field_worker",
  };

  // Create test complaint assigned to department & worker
  const complaint1 = await Complaint.create({
    title: "[TEST_FW_OFF] Complaint 1 Pothole",
    description: "Deep pothole on main avenue",
    category: "Road Damage",
    department: deptName,
    status: "submitted",
    citizen: citizenUser._id,
    location: { latitude: 12.97, longitude: 77.59, address: "Main Ave" },
    aiAnalysis: { priority: "high", confidenceScore: 90, category: "Road Damage", department: deptName, duplicateDetected: false, summary: "Pothole" },
    assignment: {
      officer: officerUser._id,
      fieldWorker: fieldWorkerUser._id,
      assignedAt: new Date(),
    },
  });


  // ───────────────────────────────────────────────────────────────────────────
  // 1. Field Worker Service Tests
  // ───────────────────────────────────────────────────────────────────────────

  // 1.1 getAssignedJobs with search & status filters
  const jobsRes = await fieldWorkerService.getAssignedJobs(workerPayload, {
    status: "submitted",
    search: "Pothole",
    page: "1",
    limit: "10",
  });
  if (!jobsRes.jobs || jobsRes.jobs.length === 0) throw new Error("fieldWorker.getAssignedJobs failed");

  // 1.2 getJobDetails (Success, 404 NotFound, 403 Forbidden)
  let fwNotFoundErr = false;
  try {
    await fieldWorkerService.getJobDetails(workerPayload, new mongoose.Types.ObjectId().toString());
  } catch (err: any) {
    if (err.statusCode === 404) fwNotFoundErr = true;
  }
  if (!fwNotFoundErr) throw new Error("fieldWorker.getJobDetails expected 404");

  let fwForbiddenErr = false;
  try {
    await fieldWorkerService.getJobDetails(otherWorkerPayload, complaint1._id.toString());
  } catch (err: any) {
    if (err.statusCode === 403) fwForbiddenErr = true;
  }
  if (!fwForbiddenErr) throw new Error("fieldWorker.getJobDetails expected 403");

  const jobDetails = await fieldWorkerService.getJobDetails(workerPayload, complaint1._id.toString());
  if (jobDetails.title !== complaint1.title) throw new Error("fieldWorker.getJobDetails failed");

  // 1.3 updateJobStatus (in_progress & resolved)
  // Transition submitted -> verified first so valid transition works
  complaint1.status = "assigned";
  await complaint1.save();

  const updatedJob1 = await fieldWorkerService.updateJobStatus(
    workerPayload,
    complaint1._id.toString(),
    "in_progress",
    "Started work on site",
  );
  if (updatedJob1.status !== "in_progress") throw new Error("fieldWorker.updateJobStatus in_progress failed");

  const updatedJob2 = await fieldWorkerService.updateJobStatus(
    workerPayload,
    complaint1._id.toString(),
    "resolved",
    "Completed asphalt repair",
  );
  if (updatedJob2.status !== "resolved" || !updatedJob2.resolutionNotes?.description) {
    throw new Error("fieldWorker.updateJobStatus resolved failed");
  }

  // 1.4 uploadPhotos (before & after)
  const jobBeforePhotos = await fieldWorkerService.uploadPhotos(
    workerPayload,
    complaint1._id.toString(),
    "before",
    [{ fileName: "before.jpg", contentType: "image/jpeg", base64Data: "data" }],
  );
  if (jobBeforePhotos.beforeImages.length !== 1) throw new Error("fieldWorker.uploadPhotos before failed");

  const jobAfterPhotos = await fieldWorkerService.uploadPhotos(
    workerPayload,
    complaint1._id.toString(),
    "after",
    [{ fileName: "after.jpg", contentType: "image/jpeg", base64Data: "data" }],
  );
  if (jobAfterPhotos.afterImages.length !== 1) throw new Error("fieldWorker.uploadPhotos after failed");


  // ───────────────────────────────────────────────────────────────────────────
  // 2. Officer Service Tests
  // ───────────────────────────────────────────────────────────────────────────

  // 2.1 getDashboardStats & getDepartmentStats (Officer with Dept & Officer without Dept)
  const officerStats = await officerService.getDashboardStats(officerPayload);
  if (typeof officerStats.assigned !== "number" || typeof officerStats.pending !== "number") {
    throw new Error("officer.getDashboardStats failed");
  }

  const deptStats = await officerService.getDepartmentStats(officerPayload);
  if (typeof deptStats.total !== "number" || typeof deptStats.performanceRate !== "number") {
    throw new Error("officer.getDepartmentStats failed");
  }

  // Officer not mapped to a department
  const unmappedOfficerPayload: TokenPayload = {
    userId: otherWorkerUser._id.toString(), // not in any department officers array
    email: otherWorkerUser.email,
    role: "officer",
  };
  const unmappedDashboard = await officerService.getDashboardStats(unmappedOfficerPayload);
  if (typeof unmappedDashboard.assigned !== "number") throw new Error("officer.getDashboardStats unmapped failed");

  const unmappedDeptStats = await officerService.getDepartmentStats(unmappedOfficerPayload);
  if (unmappedDeptStats.total !== 0) throw new Error("officer.getDepartmentStats unmapped failed");

  // 2.2 getComplaints with status, priority, assignedWorker, search (string & ObjectId), sortBy (priority, status, assignmentDate)
  const complaint2 = await Complaint.create({
    title: "[TEST_FW_OFF] Complaint 2 Water Leak",
    description: "Burst pipe on 5th street",
    category: "Water Supply",
    department: deptName,
    status: "verified",
    citizen: citizenUser._id,
    location: { latitude: 12.97, longitude: 77.59, address: "5th St" },
    aiAnalysis: { priority: "critical", confidenceScore: 95, category: "Water Supply", department: deptName, duplicateDetected: false, summary: "Water leak" },
  });

  const complaintsList = await officerService.getComplaints(officerPayload, {
    status: "verified",
    priority: "critical",
    search: complaint2._id.toString(), // search by valid ObjectId
    sortBy: "priority",
    page: 1,
    limit: 10,
  });
  if (!complaintsList.complaints || complaintsList.complaints.length === 0) throw new Error("officer.getComplaints failed");

  // Test sortBy status and assignmentDate
  await officerService.getComplaints(officerPayload, { sortBy: "status" });
  await officerService.getComplaints(officerPayload, { sortBy: "assignmentDate" });
  // Unmapped officer getComplaints fallback
  await officerService.getComplaints(unmappedOfficerPayload, {});

  // 2.3 getComplaintDetails (Success, 404, 403 Dept Mismatch, 403 Unassigned Officer)
  let offNotFoundErr = false;
  try {
    await officerService.getComplaintDetails(officerPayload, new mongoose.Types.ObjectId().toString());
  } catch (err: any) {
    if (err.statusCode === 404) offNotFoundErr = true;
  }
  if (!offNotFoundErr) throw new Error("officer.getComplaintDetails expected 404");

  // Create another department to test department mismatch 403
  const otherDept = await Department.create({
    name: `Other_Dept_${Date.now()}`,
    description: "Other Dept",
    contactInfo: "other@test.com",
  });
  const otherDeptComplaint = await Complaint.create({
    title: "[TEST_FW_OFF] Other Dept Complaint",
    description: "Other dept issue",
    category: "Garbage Management",
    department: otherDept.name,
    status: "submitted",
    citizen: citizenUser._id,
    location: { latitude: 10, longitude: 10, address: "Addr" },
  });

  let offDeptForbidden = false;
  try {
    await officerService.getComplaintDetails(officerPayload, otherDeptComplaint._id.toString());
  } catch (err: any) {
    if (err.statusCode === 403) offDeptForbidden = true;
  }
  if (!offDeptForbidden) throw new Error("officer.getComplaintDetails expected 403 dept mismatch");

  // Unmapped officer forbidden branch
  let offUnassignedForbidden = false;
  try {
    await officerService.getComplaintDetails(unmappedOfficerPayload, otherDeptComplaint._id.toString());
  } catch (err: any) {
    if (err.statusCode === 403) offUnassignedForbidden = true;
  }
  if (!offUnassignedForbidden) throw new Error("officer.getComplaintDetails expected 403 unassigned officer");

  const complaintDetails = await officerService.getComplaintDetails(officerPayload, complaint2._id.toString());
  if (complaintDetails.title !== complaint2.title) throw new Error("officer.getComplaintDetails failed");

  // 2.4 assignWorker (Success auto-transition to assigned & Invalid worker role 400)
  let invalidWorkerErr = false;
  try {
    await officerService.assignWorker(officerPayload, complaint2._id.toString(), citizenUser._id.toString());
  } catch (err: any) {
    if (err.statusCode === 400) invalidWorkerErr = true;
  }
  if (!invalidWorkerErr) throw new Error("officer.assignWorker expected 400 invalid worker role");

  const assignedComplaint = await officerService.assignWorker(
    officerPayload,
    complaint2._id.toString(),
    fieldWorkerUser._id.toString(),
    "Please fix urgently",
  );
  if (assignedComplaint.status !== "assigned") throw new Error("officer.assignWorker status transition failed");

  // 2.5 transitionStatus
  const transitionedComplaint = await officerService.transitionStatus(
    officerPayload,
    complaint2._id.toString(),
    "in_progress",
    "Advanced to in_progress",
    "Officer progressing ticket",
  );
  if (transitionedComplaint.status !== "in_progress") throw new Error("officer.transitionStatus failed");

  // 2.6 addInternalNote
  const notedComplaint = await officerService.addInternalNote(
    officerPayload,
    complaint2._id.toString(),
    "Field team on location now",
  );
  if (notedComplaint.internalNotes.length !== 1) throw new Error("officer.addInternalNote failed");

  // 2.7 submitResolution
  const resolvedComplaint = await officerService.submitResolution(
    officerPayload,
    complaint2._id.toString(),
    "Water pipe repaired successfully",
    "Installed heavy duty replacement valve",
  );
  if (resolvedComplaint.status !== "resolved" || !resolvedComplaint.resolutionNotes?.description) {
    throw new Error("officer.submitResolution failed");
  }

  // 2.8 getAvailableWorkers (Dept roster branch & fallback all workers branch)
  const deptWorkers = await officerService.getAvailableWorkers(officerPayload);
  if (!Array.isArray(deptWorkers) || deptWorkers.length === 0) throw new Error("officer.getAvailableWorkers failed");

  const fallbackWorkers = await officerService.getAvailableWorkers(unmappedOfficerPayload);
  if (!Array.isArray(fallbackWorkers) || fallbackWorkers.length === 0) throw new Error("officer.getAvailableWorkers fallback failed");

  // Clean up created department object
  await Department.findByIdAndDelete(deptObj._id);
  await Department.findByIdAndDelete(otherDept._id);

  console.log("✅ Field Worker & Officer Service Tests PASSED cleanly!");
  return true;
};
