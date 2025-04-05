import { createServer } from 'http';
import { io as Client } from 'socket.io-client';
import { server as httpServer, io, app } from '../index.js'; // Import app and io
import { pool } from '../db/pool.js';
import request from 'supertest'; 
import { v4 as uuidv4 } from 'uuid';

describe('Planning Poker Socket Events (/poker namespace)', () => {
  let clientSocket1, clientSocket2;
  let httpServerAddr;
  let testRoomId = `poker-socket-test-${Date.now()}`;
  let testRoomPassword = 'socktestpassword';
  let publicRoomId = `public-poker-socket-${Date.now()}`;
  let authToken; // For authenticated tests if needed later
  let userId;
  let testUserName = 'Poker Sock User Auth'; // Define username for auth tests

  // Setup: Start server, create rooms via API, register user
  beforeAll(async () => {
    await new Promise(resolve => {
      httpServer.listen(() => {
        httpServerAddr = httpServer.address();
        resolve();
      });
    });

    // Create a public room
    const resPublic = await request(app)
      .post('/api/poker/rooms')
      .send({ roomId: publicRoomId, name: 'Public Poker Socket Room' });
    expect(resPublic.statusCode).toEqual(200);


    // Create a password-protected room
    const resPwd = await request(app)
      .post('/api/poker/rooms')
      .send({ roomId: testRoomId, name: 'Pwd Poker Socket Room', password: testRoomPassword });
    expect(resPwd.statusCode).toEqual(200);
      
    // Register a user (for potential future authenticated tests)
     const userEmail = `poker_sock_user_auth_${Date.now()}@example.com`;
     const userPassword = 'password123';
     const resRegister = await request(app)
       .post('/api/auth/register')
       .send({ email: userEmail, password: userPassword, name: testUserName });
     expect(resRegister.statusCode).toEqual(201);
     authToken = resRegister.body.token; 
     userId = resRegister.body.user.id;
  });

  // Teardown: Close server, io, pool
  afterAll(async () => {
    clientSocket1?.close();
    clientSocket2?.close();
    io.close(); 
    await new Promise(resolve => httpServer.close(resolve)); 
  });

  // --- Anonymous Access Tests ---
  describe('Anonymous Access', () => {
    beforeEach((done) => {
      const url = `http://localhost:${httpServerAddr.port}/poker`;
      clientSocket1 = Client(url, { forceNew: true, transports: ['websocket'] });
      clientSocket1.on('connect', done);
      clientSocket1.on('connect_error', (err) => done(err));
    });

    afterEach(() => {
      if (clientSocket1?.connected) clientSocket1.disconnect();
      if (clientSocket2?.connected) clientSocket2.disconnect();
    });

    it('should allow joining a public room', (done) => {
      const userName = 'AnonAlice';
      clientSocket1.emit('joinRoom', { roomId: publicRoomId, userName });
      clientSocket1.on('roomJoined', (data) => {
        expect(data.participants.some(p => p.name === userName)).toBe(true);
        done();
      });
      clientSocket1.on('error', (err) => done(new Error(`Join error: ${err.message}`)));
    });

    it('should allow joining a password room with correct password', (done) => {
      const userName = 'AnonBob';
      clientSocket1.emit('joinRoom', { roomId: testRoomId, userName, password: testRoomPassword });
      clientSocket1.on('roomJoined', (data) => {
        expect(data.participants.some(p => p.name === userName)).toBe(true);
        done();
      });
      clientSocket1.on('error', (err) => done(new Error(`Join error: ${err.message}`)));
    });

    it('should reject joining a password room with incorrect password', (done) => {
      const userName = 'AnonCharlie';
      clientSocket1.emit('joinRoom', { roomId: testRoomId, userName, password: 'wrongpassword' });
      clientSocket1.on('error', (err) => {
        expect(err.message).toEqual('Invalid password');
        done();
      });
      clientSocket1.on('roomJoined', () => done(new Error('Should not have joined with wrong password')));
    });
    
    it('should reject joining a non-existent room', (done) => {
        const userName = 'AnonDavid';
        clientSocket1.emit('joinRoom', { roomId: 'non-existent', userName });
        clientSocket1.on('error', (err) => {
          expect(err.message).toEqual('Room not found');
          done();
        });
        clientSocket1.on('roomJoined', () => done(new Error('Should not have joined non-existent room')));
      });

    it('should allow voting and update participants', (done) => {
        const userName = 'AnonAlice';
        const voteValue = '5';
        clientSocket1.emit('joinRoom', { roomId: publicRoomId, userName });
        clientSocket1.once('roomJoined', () => {
            clientSocket1.emit('vote', { roomId: publicRoomId, vote: voteValue });
            clientSocket1.on('participantUpdate', (data) => {
                const participant = data.participants.find(p => p.id === clientSocket1.id);
                expect(participant).toBeDefined();
                expect(participant.name).toEqual(userName);
                done();
            });
             clientSocket1.on('error', (err) => done(new Error(`Vote error: ${err.message}`)));
        });
         clientSocket1.on('error', (err) => done(new Error(`Join error: ${err.message}`)));
      });
    
      it('should reveal votes', (done) => {
        const userName = 'AnonAlice';
        clientSocket1.emit('joinRoom', { roomId: publicRoomId, userName });
        clientSocket1.once('roomJoined', () => {
            clientSocket1.emit('revealVotes', { roomId: publicRoomId });
            clientSocket1.on('votesRevealed', () => done());
             clientSocket1.on('error', (err) => done(new Error(`Reveal error: ${err.message}`)));
        });
         clientSocket1.on('error', (err) => done(new Error(`Join error: ${err.message}`)));
      });
    
      it('should reset votes', (done) => {
        const userName = 'AnonAlice';
        clientSocket1.emit('joinRoom', { roomId: publicRoomId, userName });
        clientSocket1.once('roomJoined', () => {
            clientSocket1.emit('resetVotes', { roomId: publicRoomId });
            clientSocket1.on('votesReset', () => {
                 // Add check for participant update after reset
                 clientSocket1.on('participantUpdate', (data) => {
                    const participant = data.participants.find(p => p.id === clientSocket1.id);
                    expect(participant).toBeDefined();
                    expect(participant.vote).toBeNull(); // Vote should be null after reset
                    done();
                });
            });
             clientSocket1.on('error', (err) => done(new Error(`Reset error: ${err.message}`)));
        });
         clientSocket1.on('error', (err) => done(new Error(`Join error: ${err.message}`)));
      });
    
      it('should allow changing name', (done) => {
          const initialName = 'AnonAlice';
          const newName = 'AnonAlice B.';
          clientSocket1.emit('joinRoom', { roomId: publicRoomId, userName: initialName });
          clientSocket1.once('roomJoined', () => {
              clientSocket1.emit('changeName', { roomId: publicRoomId, newName: newName });
              clientSocket1.on('participantUpdate', (data) => {
                  const participant = data.participants.find(p => p.id === clientSocket1.id);
                  expect(participant).toBeDefined();
                  expect(participant.name).toEqual(newName);
                  done();
              });
               clientSocket1.on('error', (err) => done(new Error(`Change name error: ${err.message}`)));
          });
           clientSocket1.on('error', (err) => done(new Error(`Join error: ${err.message}`)));
      });
    
      it('should remove participant on disconnect', (done) => {
          const userName1 = 'AnonAlice';
          const userName2 = 'AnonBob';
          const url = `http://localhost:${httpServerAddr.port}/poker`;
          clientSocket2 = Client(url, { forceNew: true, transports: ['websocket'] });
          let client1Joined = false;
          let client2Joined = false;
    
          const checkDone = () => {
              if (client1Joined && client2Joined) clientSocket1.disconnect();
          };
    
          clientSocket1.emit('joinRoom', { roomId: publicRoomId, userName: userName1 });
          clientSocket1.once('roomJoined', () => { client1Joined = true; checkDone(); });
    
          clientSocket2.on('connect', () => {
              clientSocket2.emit('joinRoom', { roomId: publicRoomId, userName: userName2 });
              clientSocket2.once('roomJoined', () => {
                  client2Joined = true;
                  clientSocket2.on('participantUpdate', (data) => {
                      const alice = data.participants.find(p => p.name === userName1);
                      expect(alice).toBeUndefined();
                      const bob = data.participants.find(p => p.name === userName2);
                      expect(bob).toBeDefined();
                      done();
                  });
                   clientSocket2.on('error', (err) => done(new Error(`Client 2 error: ${err.message}`)));
                  checkDone();
              });
          });
           clientSocket1.on('error', (err) => done(new Error(`Client 1 error: ${err.message}`)));
           clientSocket2.on('connect_error', (err) => done(new Error(`Client 2 connect error: ${err.message}`)));
      });
  });

  // --- Authenticated Access Tests ---
  describe('Authenticated Access', () => {
      // We already have authToken, userId, testUserName from the top-level beforeAll
      
      beforeEach((done) => {
        const url = `http://localhost:${httpServerAddr.port}/poker`;
        // Pass auth token if socket authentication is implemented
        clientSocket1 = Client(url, { 
            forceNew: true, 
            transports: ['websocket'],
            // auth: { token: authToken } 
        });
        clientSocket1.on('connect', done);
        clientSocket1.on('connect_error', (err) => done(err));
      });
  
      afterEach(() => {
        if (clientSocket1?.connected) clientSocket1.disconnect();
      });

      it('should allow an authenticated user to join a public room', (done) => {
        const userName = testUserName; // Use name from registered user
        clientSocket1.emit('joinRoom', { roomId: publicRoomId, userName });
        clientSocket1.on('roomJoined', (data) => {
            expect(data.participants.some(p => p.name === userName)).toBe(true);
            done();
        });
        clientSocket1.on('error', (err) => done(new Error(`Join error: ${err.message}`)));
      });
      
       it('should allow an authenticated user to join a password room', (done) => {
        const userName = testUserName; 
        clientSocket1.emit('joinRoom', { roomId: testRoomId, userName, password: testRoomPassword });
        clientSocket1.on('roomJoined', (data) => {
            expect(data.participants.some(p => p.name === userName)).toBe(true);
            done();
        });
        clientSocket1.on('error', (err) => done(new Error(`Join error: ${err.message}`)));
      });

      // Add more tests specific to authenticated users if functionality differs
      // For example, if joining links the socket to the userId internally
  });
});
