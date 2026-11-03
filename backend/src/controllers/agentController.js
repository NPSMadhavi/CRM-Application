import bcrypt from 'bcryptjs';
import { prisma } from '../config/db.js';

export async function getAgents(req, res, next) {
  try {
    const agents = await prisma.user.findMany({
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        department: true,
        avatarUrl: true,
        phone: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            tickets: {
              where: {
                status: { in: ['ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER'] }
              }
            }
          }
        }
      }
    });

    const formatted = agents.map(a => ({
      ...a,
      activeTicketCount: a._count.tickets
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    next(error);
  }
}

export async function createAgent(req, res, next) {
  try {
    const { email, password, fullName, role, department, phone } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({ success: false, message: 'Email, password, and full name are required' });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const agent = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash,
        fullName,
        role: role || 'AGENT',
        department: department || 'IT Support',
        phone: phone || null
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        department: true,
        avatarUrl: true,
        phone: true,
        isActive: true
      }
    });

    res.status(201).json({ success: true, agent });
  } catch (error) {
    next(error);
  }
}

export async function updateAgent(req, res, next) {
  try {
    const { id } = req.params;
    const { fullName, email, role, department, phone, isActive, password } = req.body;

    const data = {};
    if (fullName !== undefined) data.fullName = fullName;
    if (email !== undefined && email.trim()) {
      const trimmedEmail = email.toLowerCase().trim();
      const existing = await prisma.user.findFirst({
        where: {
          email: trimmedEmail,
          NOT: { id }
        }
      });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Email is already taken by another user' });
      }
      data.email = trimmedEmail;
    }
    if (role !== undefined) data.role = role;
    if (department !== undefined) data.department = department;
    if (phone !== undefined) data.phone = phone;
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    if (password && password.trim()) {
      const salt = await bcrypt.genSalt(10);
      data.passwordHash = await bcrypt.hash(password, salt);
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        department: true,
        avatarUrl: true,
        phone: true,
        isActive: true
      }
    });

    res.json({ success: true, agent: updated });
  } catch (error) {
    next(error);
  }
}

export async function getAgentById(req, res, next) {
  try {
    const { id } = req.params;
    const agent = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        department: true,
        avatarUrl: true,
        phone: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            tickets: true
          }
        }
      }
    });

    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }

    res.json({ success: true, agent });
  } catch (error) {
    next(error);
  }
}

export async function deleteAgent(req, res, next) {
  try {
    const { id } = req.params;

    if (req.user && req.user.id === id) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    }

    const agent = await prisma.user.findUnique({ where: { id } });
    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }

    // Reassign active tickets assigned to this agent so they are not orphaned
    await prisma.ticket.updateMany({
      where: { assignedToId: id },
      data: { assignedToId: null, status: 'OPEN' }
    });

    await prisma.user.delete({ where: { id } });

    res.json({ success: true, message: 'Agent deleted successfully' });
  } catch (error) {
    next(error);
  }
}

