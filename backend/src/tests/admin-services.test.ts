import { userManagementService } from "../modules/admin/services/user-management.service";

export const testAdminServices = async () => {
  const users = await userManagementService.getUsers({ page: 1, limit: 10 });
  return typeof users.total === "number";
};
