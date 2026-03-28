import { io, Socket } from 'socket.io-client';
import { getEnv } from './env';

const SOCKET_URL = getEnv(['VITE_SOCKET_IO_URL', 'REACT_APP_SOCKET_IO_URL'], 'http://localhost:3000');

const socket: Socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 2000,
  timeout: 5000,
});

export default socket;