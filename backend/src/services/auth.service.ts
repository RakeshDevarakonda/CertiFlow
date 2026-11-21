import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { prisma } from '../config/db.js';
import { config } from '../config/env.js';
import { AuthUserPayload } from '../middlewares/auth.middleware.js';

export interface SignupCentreDto {
  name: string;
  email: string;
  password: string;
  centreName: string;
  centreCode: string;
  state: string;
  district: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export class AuthService {
  private generateToken(payload: AuthUserPayload): string {
    return jwt.sign(payload, config.jwtSecret, {
      expiresIn: '7d'
    });
  }

  async signupTrainingCentre(data: SignupCentreDto) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase().trim() }
    });

    if (existingUser) {
      throw new Error('An account with this email already exists.');
    }

    const existingCentre = await prisma.trainingCentre.findUnique({
      where: { code: data.centreCode.toUpperCase().trim() }
    });

    if (existingCentre) {
      throw new Error('A training centre with this code already exists.');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: data.name.trim(),
          email: data.email.toLowerCase().trim(),
          passwordHash,
          role: Role.TRAINING_CENTRE,
          state: data.state.trim(),
          district: data.district.trim()
        }
      });

      const centre = await tx.trainingCentre.create({
        data: {
          code: data.centreCode.toUpperCase().trim(),
          name: data.centreName.trim(),
          state: data.state.trim(),
          district: data.district.trim(),
          userId: user.id
        }
      });

      return { user, centre };
    });

    const tokenPayload: AuthUserPayload = {
      id: result.user.id,
      email: result.user.email,
      role: result.user.role,
      state: result.user.state,
      district: result.user.district,
      centreId: result.centre.id
    };

    const token = this.generateToken(tokenPayload);

    return {
      token,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        state: result.user.state,
        district: result.user.district,
        trainingCentre: {
          id: result.centre.id,
          code: result.centre.code,
          name: result.centre.name
        }
      }
    };
  }

  async login(data: LoginDto) {
    const user = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase().trim() },
      include: { trainingCentre: true }
    });

    if (!user) {
      throw new Error('Invalid email or password.');
    }

    const isMatch = await bcrypt.compare(data.password, user.passwordHash);
    if (!isMatch) {
      throw new Error('Invalid email or password.');
    }

    const tokenPayload: AuthUserPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      state: user.state,
      district: user.district,
      centreId: user.trainingCentre?.id || null
    };

    const token = this.generateToken(tokenPayload);

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        state: user.state,
        district: user.district,
        trainingCentre: user.trainingCentre
          ? {
              id: user.trainingCentre.id,
              code: user.trainingCentre.code,
              name: user.trainingCentre.name
            }
          : null
      }
    };
  }

  async getCurrentUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { trainingCentre: true }
    });

    if (!user) {
      throw new Error('User not found.');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      state: user.state,
      district: user.district,
      trainingCentre: user.trainingCentre
        ? {
            id: user.trainingCentre.id,
            code: user.trainingCentre.code,
            name: user.trainingCentre.name
          }
        : null
    };
  }
}

export const authService = new AuthService();
