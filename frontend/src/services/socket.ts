import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected to real-time server:', socket?.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });
  }
  return socket;
}

export function joinTicketRoom(ticketId: string) {
  const s = getSocket();
  s.emit('join:ticket', ticketId);
}

export function leaveTicketRoom(ticketId: string) {
  const s = getSocket();
  s.emit('leave:ticket', ticketId);
}

export function joinAgentRoom(agentId: string) {
  const s = getSocket();
  s.emit('join:agent', agentId);
}

