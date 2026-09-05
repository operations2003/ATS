import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import jobRoutes from './routes/jobRoutes';
import userRoutes from './routes/userRoutes';
import candidateRoutes from './routes/candidateRoutes';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'TaskNera ATS Backend API',
    version: '1.0.0',
    health: '/api/health',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'Backend server is running successfully',
    timestamp: new Date().toISOString()
  });
});

import { protect, optionalProtect } from './middleware/authMiddleware';
import {
  getCandidateEvaluation,
  getAllEvaluations,
  updateEvaluationDecisionController,
  deleteEvaluationController
} from './controllers/evaluationController';

// Authentication, User, Job, Candidate & Evaluation Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/candidates', candidateRoutes);

// Evaluation Endpoints (Secured by database-level ownership)
app.get('/api/evaluations', protect, getAllEvaluations);
app.get('/api/evaluations/:id', protect, getCandidateEvaluation);
app.post('/api/evaluations/:id/decision', protect, updateEvaluationDecisionController);
app.patch('/api/evaluations/:id/decision', protect, updateEvaluationDecisionController);
app.delete('/api/evaluations/:id', protect, deleteEvaluationController);

import { ensureDefaultAdmin } from './controllers/authController';

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[Backend] Server listening on http://localhost:${PORT}`);
    ensureDefaultAdmin();
  });
}

export default app;
