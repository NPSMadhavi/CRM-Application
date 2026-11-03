import express from 'express';
import {
  getTickets,
  getTicketById,
  createManualTicket,
  updateStatus,
  assign,
  postReply,
  postNote,
  getAuditLogs,
  logWork,
  getTicketWorkLogs
} from '../controllers/ticketController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getTickets);
router.post('/', createManualTicket);
router.get('/:id', getTicketById);
router.patch('/:id/status', updateStatus);
router.patch('/:id/assign', assign);
router.post('/:id/reply', postReply);
router.post('/:id/note', postNote);
router.get('/:id/audit-logs', getAuditLogs);
router.get('/:id/work-logs', getTicketWorkLogs);
router.post('/:id/work-logs', logWork);

export default router;
