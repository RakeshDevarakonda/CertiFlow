import dotenv from 'dotenv';

dotenv.config();

const getRequiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const config = {
  port: Number(getRequiredEnv('PORT')),
  corsOrigin: getRequiredEnv('CORS_ORIGIN')
} as const;

export type Config = typeof config;
