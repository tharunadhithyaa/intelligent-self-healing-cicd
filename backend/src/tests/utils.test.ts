import { hashPassword, comparePassword } from "../utils/password.util";

export const testUtils = async () => {
  const hash = await hashPassword("Secret123!");
  const match = await comparePassword("Secret123!", hash);
  return match;
};
