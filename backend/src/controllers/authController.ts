import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../config/prisma';
import { AuthRequest, UserRole } from '../middleware/authMiddleware';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (userId: string, email: string, role: UserRole, organizationId: string = 'org-tasknera'): string => {
  const secret = process.env.JWT_SECRET || 'ats_tasknera_super_secret_jwt_key_2026';
  const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
  return jwt.sign({ userId, email, role, organizationId }, secret, { expiresIn: expiresIn as any });
};


const DESIGNATED_ADMIN_EMAIL = 'sheetalbedi@tasknera.com';

/**
 * Ensure default admin account exists in PostgreSQL
 */
export const ensureDefaultAdmin = async (): Promise<void> => {
  try {
    const adminEmail = DESIGNATED_ADMIN_EMAIL.toLowerCase().trim();
    const hashedPassword = await bcrypt.hash('admin12345', 10);

    // 1. Ensure designated admin exists with ADMIN role
    const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!existing) {
      await prisma.user.create({
        data: {
          name: 'Sheetal Bedi',
          email: adminEmail,
          password: hashedPassword,
          role: 'ADMIN',
          organizationId: 'org-tasknera'
        }
      });
      console.log(`[Auth] Designated Administrator account (${adminEmail}) initialized in database.`);
    } else {
      await prisma.user.update({
        where: { email: adminEmail },
        data: {
          role: 'ADMIN',
          password: hashedPassword
        }
      });
      console.log(`[Auth] Designated Administrator account (${adminEmail}) verified as ADMIN in database.`);
    }

    // 2. Demote any other accounts that were previous admins
    await prisma.user.updateMany({
      where: {
        email: { not: adminEmail },
        role: 'ADMIN'
      },
      data: {
        role: 'MEMBER'
      }
    });
  } catch (err) {
    console.error('[Auth] Failed to initialize default admin account:', err);
  }
};

// @desc    Register a new user (Disabled for public self-registration)
// @route   POST /api/auth/signup
// @access  Public (Disabled - Admin only)
export const signup = async (_req: Request, res: Response): Promise<void> => {
  // Public self-registration is strictly forbidden by policy
  res.status(403).json({
    error: 'Account creation is restricted to administrators. Self-registration is disabled.'
  });
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/signin
// @access  Public
export const signin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Please provide email and password' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();

    // Query real user from database
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail }
    });

    if (!user) {
      // User does not exist in database - do NOT auto-create
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Compare submitted password against hashed database password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const orgId = user.organizationId || 'org-tasknera';
    const userRole = user.role as UserRole;
    const token = generateToken(user.id, user.email, userRole, orgId);

    res.status(200).json({
      message: 'Signed in successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: userRole,
        teamId: user.teamId,
        organizationId: orgId,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Signin Error:', error);
    res.status(500).json({ error: 'Server error during signin' });
  }
};

// @desc    Get current logged in user profile
// @route   GET /api/auth/me
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authorized' });
      return;
    }

    let user: any = null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.user.userId || '');
    
    if (isUuid) {
      user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          teamId: true,
          organizationId: true,
          createdAt: true,
          updatedAt: true
        }
      });
    }

    if (!user && req.user.email) {
      user = await prisma.user.findUnique({
        where: { email: req.user.email.toLowerCase().trim() },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          teamId: true,
          organizationId: true,
          createdAt: true,
          updatedAt: true
        }
      });
    }

    if (!user) {
      res.status(404).json({ error: 'User not found in database' });
      return;
    }

    res.status(200).json({ user });
  } catch (error) {
    console.error('GetMe Error:', error);
    res.status(500).json({ error: 'Server error fetching user profile' });
  }
};

// @desc    Authenticate with Google OAuth (Only permitted for existing database accounts)
// @route   POST /api/auth/google
export const googleSignin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      res.status(400).json({ error: 'Google ID token is required' });
      return;
    }

    // Verify the Google ID token
    let payload: any;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (verifyErr) {
      console.error('[AuthController] Google token verification failed:', verifyErr);
      res.status(401).json({ error: 'Invalid Google token. Please try signing in again.' });
      return;
    }

    if (!payload || !payload.email) {
      res.status(400).json({ error: 'Could not retrieve email from Google account' });
      return;
    }

    const cleanEmail = payload.email.toLowerCase().trim();

    // Verify user exists in database
    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (!user) {
      res.status(403).json({
        error: 'Account not found. Self-registration is disabled. Please contact an administrator to provision your account.'
      });
      return;
    }

    const token = generateToken(user.id, user.email, user.role as UserRole, user.organizationId || 'org-tasknera');

    res.status(200).json({
      message: 'Google authentication successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: payload.picture || null,
        teamId: user.teamId,
        organizationId: user.organizationId || 'org-tasknera',
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Google Auth Error:', error);
    res.status(500).json({ error: 'Server error during Google authentication' });
  }
};



