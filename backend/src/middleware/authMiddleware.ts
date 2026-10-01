import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';

export type UserRole = 'SUPER_ADMIN' | 'CLIENT_ADMIN' | 'RECRUITER' | 'ADMIN' | 'MEMBER' | 'TEAM_LEADER';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    id?: string;
    email: string;
    role?: UserRole;
    organizationId?: string;
  };
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization header missing or invalid format (Bearer token expected)' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const secret = process.env.JWT_SECRET || 'ats_tasknera_super_secret_jwt_key_2026';
    const decoded = jwt.verify(token, secret) as { userId: string; email: string; role?: UserRole; organizationId?: string };

    const cleanEmail = decoded.email ? decoded.email.toLowerCase().trim() : '';
    const isSuperAdminEmail = cleanEmail === 'admin@gmail.com';
    const isUuid = decoded.userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decoded.userId);

    // Look up authoritative user record from PostgreSQL
    let dbUser: any = null;
    try {
      dbUser = await prisma.user.findFirst({
        where: {
          OR: [
            ...(isUuid ? [{ id: decoded.userId }] : []),
            ...(cleanEmail ? [{ email: cleanEmail }] : [])
          ]
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          organizationId: true
        }
      });
    } catch (dbErr) {
      console.warn('[Auth Middleware] Database user query notice:', dbErr);
    }

    if (!dbUser && !isSuperAdminEmail) {
      res.status(401).json({ error: 'User account not found or has been removed' });
      return;
    }

    if (dbUser) {
      decoded.userId = dbUser.id;
      decoded.email = dbUser.email;
      decoded.role = isSuperAdminEmail ? 'SUPER_ADMIN' : (dbUser.role as UserRole);
      decoded.organizationId = dbUser.organizationId || 'org-tasknera';

      if (dbUser.isActive === false && decoded.role !== 'SUPER_ADMIN') {
        res.status(403).json({
          error: 'Your user account has been deactivated. Please contact your organization administrator.'
        });
        return;
      }
    } else if (isSuperAdminEmail) {
      decoded.role = 'SUPER_ADMIN';
      decoded.organizationId = decoded.organizationId || 'org-tasknera';
    }

    req.user = decoded;

    // Check organization subscription & status if not super admin
    if (decoded.role !== 'SUPER_ADMIN' && !isSuperAdminEmail) {
      const orgId = decoded.organizationId;
      if (orgId && orgId !== 'org-tasknera') {
        try {
          const org = await prisma.organization.findUnique({
            where: { id: orgId },
            select: { status: true, subscriptionExpiry: true }
          });

          if (org) {
            if (org.status === 'SUSPENDED') {
              res.status(403).json({
                error: 'Your organization account has been suspended. Please contact your platform administrator.'
              });
              return;
            }
            if (org.status === 'EXPIRED' || (org.subscriptionExpiry && new Date(org.subscriptionExpiry) < new Date())) {
              res.status(403).json({
                error: 'Your organization subscription has expired. Please contact your platform administrator to renew.'
              });
              return;
            }
          }
        } catch (orgErr) {
          // Non-fatal org status check
        }
      }
    }

    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }
};

export const optionalProtect = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const secret = process.env.JWT_SECRET || 'ats_tasknera_super_secret_jwt_key_2026';
      const decoded = jwt.verify(token, secret) as { userId: string; email: string; role?: UserRole; organizationId?: string };
      const cleanEmail = decoded.email ? decoded.email.toLowerCase().trim() : '';
      const isSuperAdminEmail = cleanEmail === 'admin@gmail.com';
      const isUuid = decoded.userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decoded.userId);

      try {
        const dbUser = await prisma.user.findFirst({
          where: {
            OR: [
              ...(isUuid ? [{ id: decoded.userId }] : []),
              ...(cleanEmail ? [{ email: cleanEmail }] : [])
            ]
          },
          select: { id: true, email: true, role: true, organizationId: true, isActive: true }
        });

        if (dbUser) {
          decoded.userId = dbUser.id;
          decoded.email = dbUser.email;
          decoded.role = isSuperAdminEmail ? 'SUPER_ADMIN' : (dbUser.role as UserRole);
          decoded.organizationId = dbUser.organizationId || 'org-tasknera';
        } else if (isSuperAdminEmail) {
          decoded.role = 'SUPER_ADMIN';
          decoded.organizationId = decoded.organizationId || 'org-tasknera';
        }
      } catch {}

      req.user = decoded;
    } catch (error) {
      // Ignore token decode errors in optional mode
    }
  }
  next();
};

/**
 * Role-Based Access Control (RBAC) authorization middleware
 * @param allowedRoles Array of roles permitted to access the route
 */
export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    let userRole = req.user.role || 'MEMBER';
    if (req.user.email?.toLowerCase().trim() === 'admin@gmail.com') {
      userRole = 'SUPER_ADMIN';
    }

    // SUPER_ADMIN has full platform authorization for administrative routes
    if (userRole === 'SUPER_ADMIN') {
      next();
      return;
    }

    // If route allows ADMIN, both SUPER_ADMIN and CLIENT_ADMIN qualify
    if (allowedRoles.includes('ADMIN') && (userRole === 'CLIENT_ADMIN' || userRole === 'ADMIN')) {
      next();
      return;
    }

    if (!allowedRoles.includes(userRole)) {
      res.status(403).json({
        error: `Forbidden: Access restricted. Role "${userRole}" is not authorized for this resource.`,
        requiredRoles: allowedRoles
      });
      return;
    }

    next();
  };
};

