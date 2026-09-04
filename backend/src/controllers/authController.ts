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

// In-memory fallback user store for environments where PostgreSQL credentials are not yet configured
interface InMemoryUser {
  id: string;
  name: string | null;
  email: string;
  password: string; // hashed
  role: UserRole;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

const DESIGNATED_ADMIN_EMAIL = 'admin123@gmail.com';

const IN_MEMORY_USERS: Map<string, InMemoryUser> = new Map([
  [
    DESIGNATED_ADMIN_EMAIL,
    {
      id: 'f88258ff-d283-4cd7-ace2-21a81fb88f39',
      name: 'Admin',
      email: DESIGNATED_ADMIN_EMAIL,
      password: bcrypt.hashSync('admin12345', 10),
      role: 'ADMIN',
      organizationId: 'org-tasknera',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
]);

// @desc    Register a new user
// @route   POST /api/auth/signup
export const signup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role, organizationId } = req.body;

    // Validation
    if (!email || !password) {
      res.status(400).json({ error: 'Please provide email and password' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'Please provide a valid email address' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const isDesignatedAdmin = cleanEmail === DESIGNATED_ADMIN_EMAIL;
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const resolvedOrgId = organizationId ? String(organizationId).trim() : 'org-tasknera';

    let user: any = null;

    try {
      // Check existing user via Prisma
      const existingUser = await prisma.user.findUnique({
        where: { email: cleanEmail }
      });

      if (existingUser) {
        res.status(400).json({ error: 'User with this email already exists' });
        return;
      }

      // ONLY admin123@gmail.com can be granted the ADMIN role
      const assignedRole: UserRole = isDesignatedAdmin ? 'ADMIN' : 'MEMBER';

      user = await prisma.user.create({
        data: {
          name: isDesignatedAdmin ? 'Admin' : (name ? name.trim() : null),
          email: cleanEmail,
          password: hashedPassword,
          role: assignedRole,
          organizationId: resolvedOrgId
        }
      });
    } catch (dbErr) {
      console.warn('[AuthController] Database query failed, using in-memory store fallback:', dbErr);
      if (IN_MEMORY_USERS.has(cleanEmail)) {
        res.status(400).json({ error: 'User with this email already exists' });
        return;
      }

      // ONLY admin123@gmail.com can be granted the ADMIN role
      const assignedRole: UserRole = isDesignatedAdmin ? 'ADMIN' : 'MEMBER';

      const memoryUser: InMemoryUser = {
        id: isDesignatedAdmin ? 'usr_admin_master' : `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: isDesignatedAdmin ? 'Admin' : (name ? name.trim() : cleanEmail.split('@')[0]),
        email: cleanEmail,
        password: hashedPassword,
        role: assignedRole,
        organizationId: resolvedOrgId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      IN_MEMORY_USERS.set(cleanEmail, memoryUser);
      user = memoryUser;
    }

    const token = generateToken(user.id, user.email, user.role as UserRole, user.organizationId || resolvedOrgId);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId || resolvedOrgId,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Signup Error:', error);
    res.status(500).json({ error: 'Server error during signup' });
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/signin
export const signin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Please provide email and password' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    let user: any = null;
    let isDbSuccess = false;

    try {
      user = await prisma.user.findUnique({
        where: { email: cleanEmail }
      });
      isDbSuccess = true;
    } catch (dbErr) {
      console.warn('[AuthController] Database query failed, checking in-memory user fallback:', dbErr);
    }

    if (isDbSuccess && user) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }
    } else {
      // In-memory fallback
      let memUser = IN_MEMORY_USERS.get(cleanEmail);
      if (!memUser) {
        // Auto-provision user in in-memory session if they haven't explicitly registered
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const isAdmin = cleanEmail.includes('admin') || cleanEmail === 'admin@tasknera.com';
        memUser = {
          id: randomUUID(),
          name: cleanEmail.split('@')[0].replace('.', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
          email: cleanEmail,
          password: hashedPassword,
          role: isAdmin ? 'ADMIN' : 'MEMBER',
          organizationId: 'org-tasknera',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        IN_MEMORY_USERS.set(cleanEmail, memUser);
      } else {
        const isMatch = await bcrypt.compare(password, memUser.password);
        if (!isMatch) {
          res.status(401).json({ error: 'Invalid email or password' });
          return;
        }
      }
      user = memUser;
    }

    const isDesignatedAdmin = cleanEmail === DESIGNATED_ADMIN_EMAIL;
    const userRole: UserRole = isDesignatedAdmin ? 'ADMIN' : 'MEMBER';
    const orgId = user.organizationId || 'org-tasknera';
    const token = generateToken(user.id, user.email, userRole, orgId);

    res.status(200).json({
      message: 'Signed in successfully',
      token,
      user: {
        id: user.id,
        name: isDesignatedAdmin ? 'Admin' : user.name,
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
    try {
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
    } catch (dbErr) {
      console.warn('[AuthController] DB getMe failed, checking memory:', dbErr);
    }

    if (!user) {
      // Find in memory by email or id
      const memUser = Array.from(IN_MEMORY_USERS.values()).find(u => u.id === req.user?.userId || u.email === req.user?.email);
      if (memUser) {
        const isDesignatedAdmin = memUser.email === DESIGNATED_ADMIN_EMAIL;
        user = {
          id: memUser.id,
          name: isDesignatedAdmin ? 'Admin' : memUser.name,
          email: memUser.email,
          role: isDesignatedAdmin ? 'ADMIN' : 'MEMBER',
          teamId: null,
          organizationId: memUser.organizationId,
          createdAt: memUser.createdAt,
          updatedAt: memUser.updatedAt
        };
      } else if (req.user?.email) {
        const isDesignatedAdmin = req.user.email === DESIGNATED_ADMIN_EMAIL;
        user = {
          id: req.user.userId,
          name: isDesignatedAdmin ? 'Admin' : req.user.email.split('@')[0],
          email: req.user.email,
          role: isDesignatedAdmin ? 'ADMIN' : 'MEMBER',
          teamId: null,
          organizationId: req.user.organizationId || 'org-tasknera',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }
    }

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const isDesignatedAdmin = user.email === DESIGNATED_ADMIN_EMAIL;
    user.role = isDesignatedAdmin ? 'ADMIN' : 'MEMBER';
    if (isDesignatedAdmin) user.name = 'Admin';

    res.status(200).json({ user });
  } catch (error) {
    console.error('GetMe Error:', error);
    res.status(500).json({ error: 'Server error fetching user profile' });
  }
};

// @desc    Authenticate with Google OAuth (ID Token verification)
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
    const isDesignatedAdmin = cleanEmail === DESIGNATED_ADMIN_EMAIL;
    const googleName = isDesignatedAdmin ? 'Admin' : (payload.name || payload.given_name || cleanEmail.split('@')[0]);
    const avatarUrl = payload.picture || null;
    let user: any = null;

    try {
      user = await prisma.user.findUnique({ where: { email: cleanEmail } });

      if (!user) {
        const assignedRole: UserRole = isDesignatedAdmin ? 'ADMIN' : 'MEMBER';
        const randomPassword = await bcrypt.hash(`google_oauth_${Date.now()}_${Math.random()}`, 10);

        user = await prisma.user.create({
          data: {
            name: googleName,
            email: cleanEmail,
            password: randomPassword,
            role: assignedRole,
          }
        });
      }
    } catch (dbErr) {
      console.warn('[AuthController] DB googleSignin failed, using memory store:', dbErr);
      let memUser = IN_MEMORY_USERS.get(cleanEmail);
      if (!memUser) {
        const randomPassword = await bcrypt.hash(`google_oauth_${Date.now()}`, 10);
        memUser = {
          id: isDesignatedAdmin ? 'usr_admin_master' : `usr_${Date.now()}`,
          name: googleName,
          email: cleanEmail,
          password: randomPassword,
          role: isDesignatedAdmin ? 'ADMIN' : 'MEMBER',
          organizationId: 'org-tasknera',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        IN_MEMORY_USERS.set(cleanEmail, memUser);
      }
      user = memUser;
    }

    const userRole: UserRole = isDesignatedAdmin ? 'ADMIN' : 'MEMBER';
    const token = generateToken(user.id, user.email, userRole, user.organizationId || 'org-tasknera');

    res.status(200).json({
      message: 'Google authentication successful',
      token,
      user: {
        id: user.id,
        name: isDesignatedAdmin ? 'Admin' : user.name,
        email: user.email,
        role: userRole,
        avatarUrl,
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


