import { Request, Response } from 'express';
import { authService } from '../services/auth.service.js';

export class AuthController {
  async signup(req: Request, res: Response): Promise<void> {
    try {
      const { name, email, password, centreName, centreCode, state, district } = req.body;

      const result = await authService.signupTrainingCentre({
        name,
        email,
        password,
        centreName,
        centreCode,
        state,
        district
      });

      // Set cookie (HTTP-only)
      res.cookie('certiflow_token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.status(201).json({
        success: true,
        message: 'Training centre registered successfully.',
        data: result
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Signup failed.'
      });
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      const result = await authService.login({ email, password });

      // Set cookie (HTTP-only)
      res.cookie('certiflow_token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.status(200).json({
        success: true,
        message: 'Logged in successfully.',
        data: result
      });
    } catch (error: any) {
      res.status(401).json({
        success: false,
        message: error.message || 'Login failed.'
      });
    }
  }

  async getMe(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized.'
        });
        return;
      }

      const user = await authService.getCurrentUser(req.user.id);

      res.status(200).json({
        success: true,
        data: user
      });
    } catch (error: any) {
      res.status(404).json({
        success: false,
        message: error.message || 'User not found.'
      });
    }
  }

  async logout(_req: Request, res: Response): Promise<void> {
    res.clearCookie('certiflow_token');
    res.status(200).json({
      success: true,
      message: 'Logged out successfully.'
    });
  }
}

export const authController = new AuthController();
