import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import admin from 'firebase-admin';
import { appliquerCoup, getCoupsLegaux, checkFinPartie } from './src/utils/gameLogic.js';
import fs from 'fs';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// Initialize Firebase Admin on the server
let db: any = null;
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    admin.initializeApp({
      projectId: firebaseConfig.projectId,
    });
    db = admin.firestore();
    db.settings({ databaseId: firebaseConfig.firestoreDatabaseId || '(default)' });
    console.log("Firebase Admin initialized on server.");
  }
} catch (e) {
  console.error("Failed to initialize Firebase Admin on server:", e);
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });

  app.use(express.json());

  // API routes FIRST
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Elo Calculation API
  app.post('/api/calculate-elo', (req, res) => {
    const { playerElo, opponentElo, result } = req.body;
    if (playerElo === undefined || opponentElo === undefined || result === undefined) {
      return res.status(400).json({ error: 'Missing parameters' });
    }
    const K = 32;
    const expectedScore = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
    const newElo = Math.round(playerElo + K * (result - expectedScore));
    res.json({ newElo });
  });

  // Payment API
  app.post('/api/create-payment-intent', async (req, res) => {
    const { amount, currency = 'eur' } = req.body;
    if (!stripe) {
      // Simulation mode for Cloud Run if keys are not set yet
      return res.json({ clientSecret: 'simulated_secret_' + Math.random().toString(36).slice(2) });
    }
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // convert to cents
        currency,
        automatic_payment_methods: { enabled: true },
      });
      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get('/api/leaderboard', async (req, res) => {
    res.status(501).json({ error: 'Not implemented without Admin SDK' });
  });

  // --- SOCKET.IO GAME SERVER ---
  // In-memory store for rooms to avoid Firestore quota issues
  const rooms = new Map<string, any>();

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('createRoom', (data) => {
      const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      rooms.set(roomId, {
        roomId,
        plateau: Array(14).fill(5),
        greniers: [0, 0],
        joueurActuel: 0,
        hostId: data.uid,
        guestId: null,
        hostName: data.name || 'Anonyme',
        guestName: null,
        hostElo: data.elo || 1200,
        guestElo: null,
        lastMove: null,
        status: 'waiting',
        moveCounter: 0,
        lastMoveTime: Date.now(),
        stakeAmount: data.stakeAmount || data.stake || 0,
        hostPaid: (data.stakeAmount || data.stake || 0) === 0,
        guestPaid: (data.stakeAmount || data.stake || 0) === 0,
        tournoi: { actif: (data.rounds || 1) > 1, mancheActuelle: 1, totalManches: data.rounds || 1, scores: [0, 0], matchHistory: [] }
      });
      socket.join(roomId);
      socket.data = { ...socket.data, roomId, uid: data.uid };
      socket.emit('roomCreated', rooms.get(roomId));
    });

    socket.on('joinRoom', (data) => {
      const room = rooms.get(data.roomId);
      if (room && (room.status === 'waiting' || room.status === 'playing')) {
        // If guest already in but just reconnecting/paying
        if (room.guestId === data.uid) {
           socket.join(data.roomId);
           socket.data = { ...socket.data, roomId: data.roomId, uid: data.uid };
           return;
        }

        if (room.guestId) {
          socket.emit('error', { message: 'Salle déjà pleine' });
          return;
        }

        room.guestId = data.uid;
        room.guestName = data.name || 'Invité';
        room.guestElo = data.elo || 1200;
        
        socket.join(data.roomId);
        socket.data = { ...socket.data, roomId: data.roomId, uid: data.uid };
        
        if (room.stakeAmount > 0 && !room.guestPaid) {
           socket.emit('paymentRequired', { stakeAmount: room.stakeAmount });
        } else if (room.hostPaid && room.guestPaid) {
           room.status = 'playing';
           io.to(data.roomId).emit('gameStarted', room);
        } else {
           io.to(data.roomId).emit('waitingForStakes', { hostPaid: room.hostPaid, guestPaid: room.guestPaid });
        }
      } else {
        socket.emit('error', { message: 'Salle introuvable' });
      }
    });

    socket.on('confirmPayment', (data) => {
      const room = rooms.get(data.roomId);
      if (!room) return;
      if (data.uid === room.hostId) room.hostPaid = true;
      if (data.uid === room.guestId) room.guestPaid = true;
      
      if (room.hostPaid && room.guestPaid) {
          room.status = 'playing';
          io.to(data.roomId).emit('gameStarted', room);
      } else {
          io.to(data.roomId).emit('paymentStatusUpdate', { hostPaid: room.hostPaid, guestPaid: room.guestPaid });
      }
    });

    socket.on('rejectStake', (data) => {
      const room = rooms.get(data.roomId);
      if (!room) return;
      if (room.guestId === data.uid || room.hostId === data.uid) {
        io.to(data.roomId).emit('roomCanceled', { reason: 'La partie a été annulée. Les mises ont été remboursées.' });
        rooms.delete(data.roomId);
      }
    });

    socket.on('playMove', async (data) => {
      const room = rooms.get(data.roomId);
      if (!room || room.status !== 'playing') return;
      
      const isHost = data.uid === room.hostId;
      const isGuest = data.uid === room.guestId;
      const role = isHost ? 0 : (isGuest ? 1 : -1);
      
      if (role !== room.joueurActuel) return;

      const legaux = getCoupsLegaux(room.plateau, role);
      if (!legaux.includes(data.move)) return;

      const plateauCopy = [...room.plateau];
      const greniersCopy = [...room.greniers];
      const message = appliquerCoup(plateauCopy, greniersCopy, role, data.move);
      
      room.plateau = plateauCopy;
      room.greniers = greniersCopy;
      room.lastMove = data.move;
      room.joueurActuel = 1 - role;
      room.moveCounter++;
      room.lastMoveTime = Date.now();

      const fin = checkFinPartie(room.plateau, room.greniers);
      if (fin !== -1) {
        room.status = 'finished';
        room.winner = fin;
        
        if (room.tournoi && room.tournoi.actif) {
          if (fin === 0) room.tournoi.scores[0]++;
          else if (fin === 1) room.tournoi.scores[1]++;
          else if (fin === 2) {
            room.tournoi.scores[0]++;
            room.tournoi.scores[1]++;
          }
        }
        
        // Save to Firestore ONLY when the game/round finishes
        if (db) {
          try {
            await db.collection('rooms').doc(data.roomId).set(room);
          } catch (e) {
            console.error("Failed to save finished room to Firestore", e);
          }
        }
      }

      io.to(data.roomId).emit('gameStateUpdate', {
        plateau: room.plateau,
        greniers: room.greniers,
        joueurActuel: room.joueurActuel,
        lastMove: room.lastMove,
        moveCounter: room.moveCounter,
        message,
        status: room.status,
        winner: room.winner,
        tournoi: room.tournoi,
        lastMoveTime: room.lastMoveTime,
        serverTime: Date.now()
      });
    });

    socket.on('nextRound', (data) => {
      const room = rooms.get(data.roomId);
      if (!room || !room.tournoi || !room.tournoi.actif) return;
      
      const isHost = data.uid === room.hostId;
      const isGuest = data.uid === room.guestId;
      if (!isHost && !isGuest) return;

      const nextRound = room.tournoi.mancheActuelle + 1;
      const premierJoueur = (nextRound - 1) % 2;
      
      room.plateau = Array(14).fill(5);
      room.greniers = [0, 0];
      room.joueurActuel = premierJoueur;
      room.lastMove = null;
      room.status = 'playing';
      room.moveCounter++;
      room.lastMoveTime = Date.now();
      room.tournoi.mancheActuelle = nextRound;
      room.winner = undefined;

      io.to(data.roomId).emit('gameStateUpdate', {
        plateau: room.plateau,
        greniers: room.greniers,
        joueurActuel: room.joueurActuel,
        lastMove: room.lastMove,
        moveCounter: room.moveCounter,
        status: room.status,
        tournoi: room.tournoi,
        lastMoveTime: room.lastMoveTime,
        serverTime: Date.now()
      });
    });

    socket.on('sendEmoji', (data) => {
      io.to(data.roomId).emit('emojiReceived', {
        text: data.text,
        sender: data.role,
        timestamp: Date.now()
      });
    });

    socket.on('forfeit', (data) => {
      const room = rooms.get(data.roomId);
      if (room && room.status === 'playing') {
        room.status = 'forfeit';
        room.forfeitBy = data.uid;
        room.forfeitRole = data.role;
        io.to(data.roomId).emit('playerForfeit', { uid: data.uid, role: data.role });
      }
    });

    socket.on('leaveRoom', (data) => {
      const room = rooms.get(data.roomId);
      if (room) {
        room.status = 'forfeit';
        room.forfeitBy = data.uid;
        io.to(data.roomId).emit('playerLeft', room);
        rooms.delete(data.roomId);
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      const roomId = socket.data?.roomId;
      const uid = socket.data?.uid;
      
      if (roomId) {
        const room = rooms.get(roomId);
        // Only trigger forfeit if it's currently an active game (not already abandoned or closed)
        if (room && room.status !== 'forfeit' && room.status !== 'finished') {
          // Verify if the disconnected user is one of the players
          if (room.hostId === uid || room.guestId === uid) {
            room.status = 'forfeit';
            room.forfeitBy = uid;
            io.to(roomId).emit('playerLeft', room);
            rooms.delete(roomId);
          }
        }
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
