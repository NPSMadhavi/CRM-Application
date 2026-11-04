import express from 'express';
import { syncEmails, getEmailStatus, testOutgoingEmail } from '../controllers/emailController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);
router.post('/sync', syncEmails);
router.get('/status', getEmailStatus);
router.post('/test', testOutgoingEmail);

export default router;
