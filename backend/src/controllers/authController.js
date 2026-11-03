import bcrypt from 'bcryptjs';
import { prisma } from '../config/db.js';
import { generateToken } from '../utils/jwt.js';

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Your account has been deactivated' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = generateToken({ id: user.id, role: user.role, email: user.email });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        department: user.department,
        avatarUrl: user.avatarUrl
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function register(req, res, next) {
  try {
    const { email, password, fullName, role, department } = req.body;
    if (!email || !password || !fullName) {
      return res.status(400).json({ success: false, message: 'Email, password, and full name are required' });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash,
        fullName,
        role: role || 'AGENT',
        department: department || 'IT Support'
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        department: true,
        avatarUrl: true
      }
    });

    const token = generateToken({ id: newUser.id, role: newUser.role, email: newUser.email });

    res.status(201).json({
      success: true,
      token,
      user: newUser
    });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        department: true,
        avatarUrl: true,
        phone: true,
        createdAt: true
      }
    });

    const assignedCount = await prisma.ticket.count({
      where: {
        assignedToId: req.user.id,
        status: { in: ['ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER'] }
      }
    });

    res.json({
      success: true,
      user: {
        ...user,
        assignedActiveTickets: assignedCount
      }
    });
  } catch (error) {
    next(error);
  }
}

