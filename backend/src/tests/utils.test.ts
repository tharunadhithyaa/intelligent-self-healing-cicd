import { hashPassword, comparePassword } from "../utils/password.util";

export const testUtils = async (): Promise<boolean> => {
  console.log("🧪 Running Password Utilities Unit Tests...");

  const plainPassword = "SecretTestPassword123!";

  // 1. Test Password Hashing
  const hash1 = await hashPassword(plainPassword);
  if (typeof hash1 !== "string" || hash1 === plainPassword || hash1.length < 20) {
    throw new Error("hashPassword failed: hash does not have expected bcrypt string format");
  }

  // Verify bcrypt format prefix ($2a$ or $2b$)
  if (!hash1.startsWith("$2a$") && !hash1.startsWith("$2b$")) {
    throw new Error("hashPassword failed: generated hash lacks bcrypt algorithm prefix");
  }

  // 2. Test Correct Password Comparison (Positive)
  const isMatchPositive = await comparePassword(plainPassword, hash1);
  if (!isMatchPositive) {
    throw new Error("comparePassword failed to match correct plain password with hash");
  }

  // 3. Test Incorrect Password Comparison (Negative)
  const isMatchNegative = await comparePassword("WrongPassword123!", hash1);
  if (isMatchNegative) {
    throw new Error("comparePassword incorrectly matched wrong password");
  }

  const isMatchEmpty = await comparePassword("", hash1);
  if (isMatchEmpty) {
    throw new Error("comparePassword incorrectly matched empty password");
  }

  // 4. Test Salt Uniqueness (Bcrypt Random Salt)
  const hash2 = await hashPassword(plainPassword);
  if (hash1 === hash2) {
    throw new Error("hashPassword failed to generate unique random salt per invocation");
  }

  const isMatchHash2 = await comparePassword(plainPassword, hash2);
  if (!isMatchHash2) {
    throw new Error("comparePassword failed to match correct password against second salted hash");
  }

  // 5. Test Special Character Passwords
  const specialPassword = "!@#$%^&*()_+~`|}{[]:;?><,./'\"";
  const specialHash = await hashPassword(specialPassword);
  const isSpecialMatch = await comparePassword(specialPassword, specialHash);
  if (!isSpecialMatch) {
    throw new Error("comparePassword failed for special character password");
  }

  // 6. Test Malformed Hash Handling
  let isMalformedMatch = true;
  try {
    isMalformedMatch = await comparePassword(plainPassword, "invalid_bcrypt_hash");
  } catch {
    isMalformedMatch = false;
  }
  if (isMalformedMatch) {
    throw new Error("comparePassword incorrectly validated malformed hash");
  }

  console.log("✅ Password Utilities Unit Tests PASSED cleanly!");
  return true;
};
