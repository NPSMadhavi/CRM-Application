import express from 'express';
import { getAgents, getAgentById, createAgent, updateAgent, deleteAgent } from '../controllers/agentController.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getAgents);
router.get('/:id', getAgentById);
router.post('/', authorizeRoles('ADMIN'), createAgent);
router.put('/:id', authorizeRoles('ADMIN'), updateAgent);
router.delete('/:id', authorizeRoles('ADMIN'), deleteAgent);

export default router;

