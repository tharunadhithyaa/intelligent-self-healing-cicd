import { userManagementService } from "../modules/admin/services/user-management.service";

export const testAdminServices = async (): Promise<boolean> => {
  const result = await userManagementService.getUsers({ page: 1, limit: 10 });

  return (
    typeof result.total === "number" &&
    result.total >= 0 &&
    Array.isArray(result.users)
  );
};
