import express from 'express';
import { SUPPORT_PLANS, isWithinWorkingHours } from '../services/supportPlanService.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/support-plans
 * Returns available plans and current working hours status
 */
router.get('/', (req, res) => {
  const plansWithStatus = SUPPORT_PLANS.map(plan => ({
    ...plan,
    status: isWithinWorkingHours(plan.workingHoursWindow)
  }));

  res.json({
    success: true,
    data: plansWithStatus
  });
});

export default router;

