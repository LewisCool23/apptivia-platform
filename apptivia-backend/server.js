require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Supabase setup
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

// REST API: User registration
app.post('/api/register', async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password || !role) return res.status(400).json({ error: 'Email, password, and role required' });
  const allowedRoles = ['Admin', 'Manager', 'Coach', 'User'];
  if (!allowedRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  const hash = await bcrypt.hash(password, 10);
  // Store user in Supabase
  const { data, error } = await supabase
    .from('users')
    .insert([{ email, password: hash, role }]);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'User registered', user: data[0] });
});

// REST API: User login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();
  if (error || !data) return res.status(401).json({ error: 'Invalid credentials' });
  const valid = await bcrypt.compare(password, data.password);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: data.id, email: data.email, role: data.role }, JWT_SECRET, { expiresIn: '1d' });
  res.json({ message: 'Login successful', token });
});

// Auth middleware
// Authorization middleware for roles
function authorize(allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Example protected route
app.get('/api/profile', authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, role')
    .eq('id', req.user.id)
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ user: data });
});

// Example: Admin-only route
app.get('/api/admin', authenticate, authorize(['Admin']), (req, res) => {
  res.json({ message: 'Welcome, Admin!' });
});

// Socket.io events
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);
  socket.on('message', (msg) => {
    io.emit('message', msg);
  });
  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

const PORT = process.env.SOCKET_IO_PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
