import mongoose from "mongoose";
import User from "../models/user.model";
import Department from "../models/department.model";
import Complaint, { ComplaintCategory } from "../models/complaint.model";
import { complaintRepository } from "../repositories/complaint.repository";

export const testRepositoriesAndControllers = async (): Promise<boolean> => {
  console.log("🧪 Running Complaint Repository & Controller Tests...");

  // Clean test data
  await User.deleteMany({ email: /^repo_ctrl_test_/ });
  await Complaint.deleteMany({ title: /^\[TEST_REPO_CTRL\]/ });
  await Department.deleteMany({ name: /^Test_Repo_Ctrl_Dept_/ });

  // 1. Create real test records in database
  const citizen = await User.create({
    firstName: "RepoCtrlCitizen",
    lastName: "Test",
    email: `repo_ctrl_test_citizen_${Date.now()}@test.com`,
    password: "hashed_password_123",
    role: "citizen",
    isActive: true,
  });

  const officer = await User.create({
    firstName: "RepoCtrlOfficer",
    lastName: "Test",
    email: `repo_ctrl_test_officer_${Date.now()}@test.com`,
    password: "hashed_password_123",
    role: "officer",
    isActive: true,
  });

  const dept = await Department.create({
    name: `Test_Repo_Ctrl_Dept_${Date.now()}`,
    description: "Department for repository test",
    contactInfo: "contact@test.com",
    status: "active",
    officers: [officer._id],
  });

  const category: ComplaintCategory = "Drainage";

  const complaint = await Complaint.create({
    title: "[TEST_REPO_CTRL] Drainage Issue",
    description: "Blocked drainage pipe near sector 4",
    category,
    department: dept.name,
    status: "submitted",
    citizen: citizen._id,
    location: { latitude: 12.97, longitude: 77.59, address: "Sector 4" },
  });

  // 2. Test findByCitizenId with real generated ID
  const findRes = await complaintRepository.findByCitizenId(citizen._id.toString());
  if (!Array.isArray(findRes) || findRes.length === 0 || findRes[0]?.title !== complaint.title) {
    throw new Error("complaintRepository.findByCitizenId failed to return created complaint");
  }

  // 3. Test updateStatus with real complaint ID & valid status
  const updateRes = await complaintRepository.updateStatus(complaint._id.toString(), "verified");
  if (!updateRes || updateRes.status !== "verified") {
    throw new Error("complaintRepository.updateStatus failed to update status to verified");
  }

  // 4. Test assignOfficer with real complaint, officer, and department IDs
  const assignRes = await complaintRepository.assignOfficer(
    complaint._id.toString(),
    officer._id.toString(),
    dept._id.toString(),
  );
  if (
    !assignRes ||
    assignRes.status !== "assigned" ||
    assignRes.assignment?.officer?.toString() !== officer._id.toString()
  ) {
    throw new Error("complaintRepository.assignOfficer failed to assign officer");
  }

  // 5. Test nonexistent ID failure/null branches
  const nonExistentId = new mongoose.Types.ObjectId().toString();

  const emptyFind = await complaintRepository.findByCitizenId(nonExistentId);
  if (!Array.isArray(emptyFind) || emptyFind.length !== 0) {
    throw new Error("complaintRepository.findByCitizenId expected empty array for nonexistent citizen");
  }

  const nullUpdate = await complaintRepository.updateStatus(nonExistentId, "verified");
  if (nullUpdate !== null) {
    throw new Error("complaintRepository.updateStatus expected null for nonexistent complaint");
  }

  const nullAssign = await complaintRepository.assignOfficer(nonExistentId, officer._id.toString());
  if (nullAssign !== null) {
    throw new Error("complaintRepository.assignOfficer expected null for nonexistent complaint");
  }

  // Clean up created entities
  await Complaint.findByIdAndDelete(complaint._id);
  await Department.findByIdAndDelete(dept._id);
  await User.findByIdAndDelete(citizen._id);
  await User.findByIdAndDelete(officer._id);

  console.log("✅ Complaint Repository & Controller Tests PASSED cleanly!");
  return true;
};
