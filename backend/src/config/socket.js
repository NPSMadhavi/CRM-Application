import { Server } from 'socket.io';
import { logger } from '../utils/logger.js';

let io = null;

export function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: '*', // Allow frontend dev server and production origins
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
    }
  });

  io.on('connection', (socket) => {
    logger.info(`[Socket.IO] Client connected: ${socket.id}`);

    // Join room for specific agent if authenticated
    socket.on('join:agent', (agentId) => {
      if (agentId) {
        socket.join(`agent:${agentId}`);
        logger.debug(`[Socket.IO] Socket ${socket.id} joined room agent:${agentId}`);
      }
    });

    // Join room for specific ticket viewing
    socket.on('join:ticket', (ticketId) => {
      if (ticketId) {
        socket.join(`ticket:${ticketId}`);
        logger.debug(`[Socket.IO] Socket ${socket.id} joined room ticket:${ticketId}`);
      }
    });

    socket.on('leave:ticket', (ticketId) => {
      if (ticketId) {
        socket.leave(`ticket:${ticketId}`);
      }
    });

    socket.on('disconnect', () => {
      logger.debug(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO() {
  return io;
}

/**
 * Broadcast event to all connected dashboard agents
 */
export function emitToAll(event, payload) {
  if (io) {
    io.emit(event, payload);
    logger.debug(`[Socket.IO Broadcast] Event: ${event}`);
  }
}

/**
 * Emit event to a specific ticket conversation room
 */
export function emitToTicket(ticketId, event, payload) {
  if (io && ticketId) {
    io.to(`ticket:${ticketId}`).emit(event, payload);
    // Also emit to all so dashboard lists update their preview
    io.emit(event, payload);
  }
}

/**
 * Emit event to a specific agent
 */
export function emitToAgent(agentId, event, payload) {
  if (io && agentId) {
    io.to(`agent:${agentId}`).emit(event, payload);
  }
}

