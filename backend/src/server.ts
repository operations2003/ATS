import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import jobRoutes from './routes/jobRoutes';
import userRoutes from './routes/userRoutes';
import candidateRoutes from './routes/candidateRoutes';
import superAdminRoutes from './routes/superAdminRoutes';
import publicRoutes from './routes/publicRoutes';
import dashboardRoutes from './routes/dashboardRoutes';

import appsumoRoutes from './routes/appsumoRoutes';
import { handleAppSumoWebhook, handleAppSumoOAuthRedirect } from './controllers/appsumoController';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware with rawBody capture for secure HMAC webhook validation
app.use(cors());
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    }
  })
);
app.use(
  express.urlencoded({
    extended: true,
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    }
  })
);

// AppSumo Direct Spec Endpoints (exact endpoints specified in AppSumo Partner Guide)
app.post('/v2/webhooks', handleAppSumoWebhook);
app.get('/v2/webhooks', (req: Request, res: Response) => {
  res.status(200).json({ status: 'active', message: 'TaskNera AppSumo Webhook Receiver is ready' });
});
app.get('/v2/redirect-url', handleAppSumoOAuthRedirect);

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
    message: 'Backend server is running successfully v1.0.1',
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

// Authentication, User, Job, Candidate, Evaluation, AppSumo, Public Application & Super Admin Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/v1/appsumo', appsumoRoutes);
app.use('/api/appsumo', appsumoRoutes);

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
