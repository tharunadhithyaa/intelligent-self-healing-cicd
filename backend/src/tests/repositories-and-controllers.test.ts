import { ComplaintCategory } from "../models/complaint.model";
import { complaintRepository } from "../repositories/complaint.repository";

export const testRepositoriesAndControllers = async () => {
  const category: ComplaintCategory = "Drainage";
  const findRes = await complaintRepository.findByCitizenId("507f1f77bcf86cd799439011");
  const updateRes = await complaintRepository.updateStatus("507f1f77bcf86cd799439011", "in_progress");
  const assignRes = await complaintRepository.assignOfficer("507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012");

  return category === "Drainage" && Array.isArray(findRes) && updateRes === null && assignRes === null;
};
