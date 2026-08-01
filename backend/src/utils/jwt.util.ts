import jwt, { SignOptions } from "jsonwebtoken";
import config from "../config";

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  const options: SignOptions = {
    expiresIn: config.jwt.accessExpiry as jwt.SignOptions["expiresIn"],
  };
  return jwt.sign(payload, config.jwt.accessSecret, options);
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  const options: SignOptions = {
    expiresIn: config.jwt.refreshExpiry as jwt.SignOptions["expiresIn"],
  };
  return jwt.sign(payload, config.jwt.refreshSecret, options);
};

export const generateTokenPair = (payload: TokenPayload): TokenPair => {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, config.jwt.accessSecret) as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, config.jwt.refreshSecret) as TokenPayload;
};

export const getRefreshTokenExpiryDate = (): Date => {
  const expiryStr = config.jwt.refreshExpiry;
  const match = expiryStr.match(/^(\d+)([dhms])$/);

  if (!match) {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default 7 days
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return new Date(
    Date.now() + value * (multipliers[unit] || 24 * 60 * 60 * 1000),
  );
};
