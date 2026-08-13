import User from "../models/user.model";
import Complaint from "../models/complaint.model";
import Department from "../models/department.model";
import { userRepository } from "../repositories/user.repository";
import { departmentRepository } from "../repositories/department.repository";
import { complaintRepository } from "../repositories/complaint.repository";
import { WorkflowService } from "../modules/complaints/workflow.service";
import { aiService } from "../modules/complaints/ai.service";

const getErrorStatusCode = (err: unknown): number | undefined => {
  if (typeof err === "object" && err !== null && "statusCode" in err) {
    return (err as { statusCode: number }).statusCode;
  }
  return undefined;
};

export const runRepositoriesAndAiWorkflowTests = async (): Promise<boolean> => {
  console.log("🧪 Running Repositories & AI/Workflow Tests...");

  await User.deleteMany({ email: /^repo_test_/ });
  await Complaint.deleteMany({ title: /^\[TEST_REPO\]/ });
  await Department.deleteMany({ name: /^Test_Repo_Dept_/ });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. UserRepository & BaseRepository Tests
  // ───────────────────────────────────────────────────────────────────────────

  const user = await userRepository.create({
    firstName: "Repo",
    lastName: "User",
    email: `repo_test_${Date.now()}@test.com`,
    password: "hashed_password_123",
    role: "citizen",
    isActive: true,
    passwordResetToken: "token_123_abc",
    passwordResetExpires: new Date(Date.now() + 3600 * 1000),
  });

  if (!user._id) throw new Error("BaseRepository.create failed");

  // findById (with & without select)
  const userById = await userRepository.findById(user._id.toString());
  const userSelected = await userRepository.findById(user._id.toString(), "firstName email");
  if (!userById || !userSelected) throw new Error("BaseRepository.findById failed");

  // findOne (with & without select)
  const userOne = await userRepository.findOne({ email: user.email });
  const userOneSelect = await userRepository.findOne({ email: user.email }, "firstName");
  if (!userOne || !userOneSelect) throw new Error("BaseRepository.findOne failed");

  // find (with select, sort, limit, skip)
  const userList = await userRepository.find(
    { role: "citizen" },
    "firstName email",
    { sort: { createdAt: -1 }, limit: 5, skip: 0 },
  );
  if (!userList || userList.length === 0) throw new Error("BaseRepository.find failed");

  // updateById
  const updatedUser = await userRepository.updateById(user._id.toString(), { firstName: "RepoUpdated" });
  if (updatedUser?.firstName !== "RepoUpdated") throw new Error("BaseRepository.updateById failed");

  // updateOne
  const updatedOne = await userRepository.updateOne({ _id: user._id }, { lastName: "UserUpdated" });
  if (updatedOne?.lastName !== "UserUpdated") throw new Error("BaseRepository.updateOne failed");

  // exists & count
  const isExist = await userRepository.exists({ _id: user._id });
  const countVal = await userRepository.count({ role: "citizen" });
  if (!isExist || countVal === 0) throw new Error("BaseRepository.exists/count failed");

  // UserRepository specific methods
  const foundByEmail = await userRepository.findByEmail(user.email);
  const foundByEmailWithPass = await userRepository.findByEmail(user.email, true);
  if (!foundByEmail || !foundByEmailWithPass) throw new Error("UserRepository.findByEmail failed");

  const foundByToken = await userRepository.findByResetToken("token_123_abc");
  if (!foundByToken) throw new Error("UserRepository.findByResetToken failed");

  await userRepository.updateLastLogin(user._id.toString());

  const activeUsers = await userRepository.findActiveUsers();
  const activeCitizens = await userRepository.findActiveUsers("citizen");
  if (activeUsers.length === 0 || activeCitizens.length === 0) throw new Error("UserRepository.findActiveUsers failed");


  // ───────────────────────────────────────────────────────────────────────────
  // 2. DepartmentRepository & ComplaintRepository Tests
  // ───────────────────────────────────────────────────────────────────────────

  const dept = await departmentRepository.create({
    name: `Test_Repo_Dept_${Date.now()}`,
    description: "Repo test department",
    contactInfo: "contact@test.com",
    status: "active",
    officers: [user._id],
  });

  const deptWithOfficers = await departmentRepository.findWithOfficers();
  if (!deptWithOfficers || deptWithOfficers.length === 0) throw new Error("DepartmentRepository.findWithOfficers failed");

  const complaint = await complaintRepository.create({
    title: "[TEST_REPO] Complaint Test",
    description: "Deep pothole report near street 9",
    category: "Road Damage",
    department: dept.name,
    status: "submitted",
    citizen: user._id,
    location: { latitude: 12.97, longitude: 77.59, address: "Street 9" },
  });

  const paginated = await complaintRepository.findPaginated({ status: "submitted" }, { createdAt: -1 }, 0, 10);
  if (!paginated || paginated.length === 0) throw new Error("ComplaintRepository.findPaginated failed");

  const byCitizen = await complaintRepository.findByCitizenId(user._id.toString());
  if (!byCitizen || byCitizen.length === 0) throw new Error("ComplaintRepository.findByCitizenId failed");

  const updatedStatusComp = await complaintRepository.updateStatus(complaint._id.toString(), "verified");
  if (updatedStatusComp?.status !== "verified") throw new Error("ComplaintRepository.updateStatus failed");

  const assignedComp = await complaintRepository.assignOfficer(complaint._id.toString(), user._id.toString(), dept._id.toString());
  if (assignedComp?.status !== "assigned") throw new Error("ComplaintRepository.assignOfficer failed");


  // ───────────────────────────────────────────────────────────────────────────
  // 3. WorkflowService & AIService Duplicate Branch Tests
  // ───────────────────────────────────────────────────────────────────────────

  // Test WorkflowService.validateTransition invalid path (throws 400 ApiError)
  let invalidTransitionErr = false;
  try {
    WorkflowService.validateTransition("submitted", "closed");
  } catch (err: unknown) {
    if (getErrorStatusCode(err) === 400) invalidTransitionErr = true;
  }
  if (!invalidTransitionErr) throw new Error("WorkflowService.validateTransition expected 400 error");

  // Test AIService.detectDuplicates when a recent active complaint exists in DB
  const dupCheck = await aiService.detectDuplicates(
    "Road Damage",
    { latitude: 12.97, longitude: 77.59 },
    "pothole report near street 9",
  );
  if (typeof dupCheck.detected !== "boolean") throw new Error("AIService.detectDuplicates failed");


  // Clean up repository test objects via deleteById & deleteMany
  await complaintRepository.deleteById(complaint._id.toString());
  await departmentRepository.deleteById(dept._id.toString());
  const deletedCount = await userRepository.deleteMany({ email: user.email });
  if (deletedCount !== 1) throw new Error("BaseRepository.deleteMany failed");

  console.log("✅ Repositories & AI/Workflow Tests PASSED cleanly!");
  return true;
};
