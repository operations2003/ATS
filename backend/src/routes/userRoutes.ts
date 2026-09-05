import { Router } from 'express';
import { getAllUsers, getTAMembers, createMember, updateUserRole, assignUserTeam, deleteUser } from '../controllers/userController';
import { protect, optionalProtect, authorize } from '../middleware/authMiddleware';

const router = Router();

// GET /api/users/ta-members - Live TA members data with real database metrics
router.get('/ta-members', optionalProtect, getTAMembers);

// GET /api/users - Available for user lists
router.get('/', optionalProtect, getAllUsers);

// Protected routes (ADMIN only)
router.post('/create-member', protect, authorize('ADMIN'), createMember);
router.post('/', protect, authorize('ADMIN'), createMember);
router.patch('/:id/role', protect, authorize('ADMIN'), updateUserRole);
router.patch('/:id/team', protect, authorize('ADMIN'), assignUserTeam);
router.delete('/:id', protect, authorize('ADMIN'), deleteUser);

export default router;
