const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// In-memory state for Phase 1 MVP
const sessions = new Map(); // sessionId -> { users: Map, canvasSnapshot: Array, history: Array }

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Join a session room
  socket.on('join-session', ({ sessionId, displayName }) => {
    socket.join(sessionId);
    
    // Initialize session if it doesn't exist
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, {
        users: new Map(),
        canvasSnapshot: [],
        history: []
      });
    }

    const session = sessions.get(sessionId);
    const user = { id: socket.id, displayName };
    session.users.set(socket.id, user);

    socket.sessionId = sessionId; // Store on socket for disconnect handling

    // Send current state to the new user
    socket.emit('session-joined', {
      users: Array.from(session.users.values()),
      canvasSnapshot: session.canvasSnapshot
    });

    // Notify others
    socket.to(sessionId).emit('user-joined', user);
  });

  // Handle drawing events
  socket.on('draw-event', (eventData) => {
    const { sessionId, eventType, payload } = eventData;
    
    if (sessions.has(sessionId)) {
      const session = sessions.get(sessionId);
      // Save event to snapshot (simplistic approach for MVP instead of Yjs)
      session.canvasSnapshot.push({ eventType, payload });
      
      // Broadcast to others in the room
      socket.to(sessionId).emit('draw-event', {
        userId: socket.id,
        eventType,
        payload
      });
    }
  });

  // Handle element updates (moving/resizing)
  socket.on('update-element', (eventData) => {
    const { sessionId, payload } = eventData;
    if (sessions.has(sessionId)) {
      const session = sessions.get(sessionId);
      // Find and update the element in the snapshot
      const index = session.canvasSnapshot.findIndex(e => e.payload.id === payload.id);
      if (index !== -1) {
        session.canvasSnapshot[index].payload = payload;
      }
      
      socket.to(sessionId).emit('update-element', payload);
    }
  });

  // Handle clear canvas
  socket.on('clear-canvas', ({ sessionId }) => {
    if (sessions.has(sessionId)) {
      const session = sessions.get(sessionId);
      session.canvasSnapshot = [];
      socket.to(sessionId).emit('clear-canvas');
    }
  });

  // Handle cursor movement
  socket.on('cursor-move', ({ sessionId, x, y }) => {
    const session = sessions.get(sessionId);
    if (session && session.users.has(socket.id)) {
      const user = session.users.get(socket.id);
      socket.to(sessionId).emit('cursor-update', {
        userId: socket.id,
        displayName: user.displayName,
        x,
        y
      });
    }
  });

  // Handle chat messages
  socket.on('chat-message', ({ sessionId, message }) => {
    const session = sessions.get(sessionId);
    if (session && session.users.has(socket.id)) {
      const user = session.users.get(socket.id);
      const chatPayload = {
        userId: socket.id,
        displayName: user.displayName,
        message,
        timestamp: new Date().toISOString()
      };
      
      // Broadcast to room including sender
      io.to(sessionId).emit('chat-message', chatPayload);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    const sessionId = socket.sessionId;
    
    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId);
      if (session.users.has(socket.id)) {
        const user = session.users.get(socket.id);
        session.users.delete(socket.id);
        
        socket.to(sessionId).emit('user-left', {
          userId: socket.id,
          displayName: user.displayName
        });

        // Clean up empty sessions
        if (session.users.size === 0) {
          sessions.delete(sessionId);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`CanvasFlow backend running on port ${PORT}`);
});
