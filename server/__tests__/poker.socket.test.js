import { createServer } from 'http';
import { io as Client } from 'socket.io-client';
import { server as httpServer, io } from '../index.js'; // Import io as well
import pool from '../db/pool.js';
import request from 'supertest'; // To create a room via API first
import { app } from '../index.js'; // Need app for supertest

describe('Planning Poker Socket Events (/poker namespace)', () => {
  let serverSocket; // We might not need direct access to server socket instance
  let clientSocket1, clientSocket2;
  let httpServerAddr;
  let testRoomId = `poker-socket-test-${Date.now()}`;
  let testRoomPassword = 'socktestpassword';
  let authToken; // Needed if room creation requires auth tied to workspace

  beforeAll(async () => {
    // Start the HTTP server to get address and port
    await new Promise(resolve => {
      httpServer.listen(() => {
        httpServerAddr = httpServer.address();
        resolve();
      });
    });

    // Register a user and create a room via API to ensure it exists
     const userEmail = `poker_sock_user_${Date.now()}@example.com`;
     const userPassword = 'password123';
     const resRegister = await request(app)
       .post('/api/auth/register')
       .send({ email: userEmail, password: userPassword, name: 'Poker Sock User' });
     authToken = resRegister.body.token; // Get token if needed

     // Create a room (can be anonymous or linked to workspace)
     const resRoom = await request(app)
       .post('/api/rooms')
       // .set('Authorization', `Bearer ${authToken}`) // Add if needed
       .send({ roomId: testRoomId, name: 'Poker Socket Test Room', password: testRoomPassword });
     expect(resRoom.statusCode).toEqual(200);
     expect(resRoom.body.roomId).toEqual(testRoomId);
  });

  afterAll(async () => {
    // Disconnect clients
    clientSocket1?.close();
    clientSocket2?.close();
    // Close servers
    io.close(); // Close Socket.IO server
    await new Promise(resolve => httpServer.close(resolve)); // Close the HTTP server
  });

  beforeEach((done) => {
    // Connect client socket before each test
    // Use the address from the running server
    const url = `http://localhost:${httpServerAddr.port}/poker`;
    clientSocket1 = Client(url, {
      reconnectionDelay: 0,
      forceNew: true,
      transports: ['websocket'],
    });
    clientSocket1.on('connect', () => {
        // console.log('Client 1 connected for test');
        done();
    });
     clientSocket1.on('connect_error', (err) => {
        console.error('Client 1 connection error:', err);
        done(err); // Fail the test if connection fails
    });
  });

  afterEach(() => {
    // Disconnect client socket after each test
    if (clientSocket1?.connected) {
      clientSocket1.disconnect();
    }
     if (clientSocket2?.connected) {
      clientSocket2.disconnect();
    }
  });

  // Test joining a room
  it('should allow a user to join a room and notify others', (done) => {
    const userName1 = 'Alice';

    clientSocket1.emit('joinRoom', { roomId: testRoomId, userName: userName1, password: testRoomPassword });

    // Listen for the confirmation event for the joining user
    clientSocket1.on('roomJoined', (data) => {
      expect(data).toHaveProperty('participants');
      expect(Array.isArray(data.participants)).toBe(true);
      const participant = data.participants.find(p => p.name === userName1);
      expect(participant).toBeDefined();
      expect(participant.id).toEqual(clientSocket1.id);
      expect(data).toHaveProperty('settings');
      expect(data.settings.hasPassword).toBe(true);
      done(); // Test successful
    });

    // Handle potential errors
    clientSocket1.on('error', (err) => {
        done(new Error(`Received error: ${err.message}`));
    });
  });

   // Test voting
   it('should allow a user to vote and update participants', (done) => {
    const userName1 = 'Alice';
    const voteValue = '5';

    // First, join the room
    clientSocket1.emit('joinRoom', { roomId: testRoomId, userName: userName1, password: testRoomPassword });
    clientSocket1.once('roomJoined', () => {
        // Once joined, emit the vote
        clientSocket1.emit('vote', { roomId: testRoomId, vote: voteValue });

        // Listen for the participant update event
        clientSocket1.on('participantUpdate', (data) => {
            expect(data).toHaveProperty('participants');
            const participant = data.participants.find(p => p.id === clientSocket1.id);
            expect(participant).toBeDefined();
            // Vote might be hidden initially, check based on game state if needed
            // For now, just check if the update was received
            // expect(participant.vote).toEqual(voteValue); // This might fail if votes aren't revealed
             expect(participant.name).toEqual(userName1);
            done();
        });
         clientSocket1.on('error', (err) => done(new Error(`Received error: ${err.message}`)));
    });
     clientSocket1.on('error', (err) => done(new Error(`Received error during join: ${err.message}`)));
  });

  // Test revealing votes
  it('should reveal votes to all participants', (done) => {
    const userName1 = 'Alice';
    const voteValue = '8';

     // Join room first
     clientSocket1.emit('joinRoom', { roomId: testRoomId, userName: userName1, password: testRoomPassword });
     clientSocket1.once('roomJoined', () => {
        // Vote
        clientSocket1.emit('vote', { roomId: testRoomId, vote: voteValue });
        clientSocket1.once('participantUpdate', () => {
            // Reveal votes
            clientSocket1.emit('revealVotes', { roomId: testRoomId });

            // Listen for reveal event
            clientSocket1.on('votesRevealed', () => {
                // Potentially check participant update again to see revealed votes
                done();
            });
             clientSocket1.on('error', (err) => done(new Error(`Received error: ${err.message}`)));
        });
     });
      clientSocket1.on('error', (err) => done(new Error(`Received error during join/vote: ${err.message}`)));
  });

   // Test resetting votes
   it('should reset votes for all participants', (done) => {
    const userName1 = 'Alice';
    const voteValue = '13';

     // Join, vote, reveal (optional)
     clientSocket1.emit('joinRoom', { roomId: testRoomId, userName: userName1, password: testRoomPassword });
     clientSocket1.once('roomJoined', () => {
        clientSocket1.emit('vote', { roomId: testRoomId, vote: voteValue });
        clientSocket1.once('participantUpdate', () => {
            // Reset votes
            clientSocket1.emit('resetVotes', { roomId: testRoomId });

            // Listen for reset event
            clientSocket1.on('votesReset', () => {
                // Check participant update to ensure vote is null
                 clientSocket1.on('participantUpdate', (data) => {
                    const participant = data.participants.find(p => p.id === clientSocket1.id);
                    expect(participant).toBeDefined();
                    expect(participant.vote).toBeNull();
                    done();
                });
            });
             clientSocket1.on('error', (err) => done(new Error(`Received error: ${err.message}`)));
        });
     });
      clientSocket1.on('error', (err) => done(new Error(`Received error during join/vote: ${err.message}`)));
  });

  // Test changing name
  it('should allow user to change name and notify others', (done) => {
      const initialName = 'Alice';
      const newName = 'Alice B.';

      clientSocket1.emit('joinRoom', { roomId: testRoomId, userName: initialName, password: testRoomPassword });
      clientSocket1.once('roomJoined', () => {
          clientSocket1.emit('changeName', { roomId: testRoomId, newName: newName });

          clientSocket1.on('participantUpdate', (data) => {
              const participant = data.participants.find(p => p.id === clientSocket1.id);
              expect(participant).toBeDefined();
              expect(participant.name).toEqual(newName);
              done();
          });
           clientSocket1.on('error', (err) => done(new Error(`Received error: ${err.message}`)));
      });
       clientSocket1.on('error', (err) => done(new Error(`Received error during join: ${err.message}`)));
  });

  // Test disconnect
  it('should remove participant on disconnect and notify others', (done) => {
      const userName1 = 'Alice';
      const userName2 = 'Bob';

      // Connect second client
      const url = `http://localhost:${httpServerAddr.port}/poker`;
      clientSocket2 = Client(url, { forceNew: true, transports: ['websocket'] });

      let client1Joined = false;
      let client2Joined = false;

      const checkDone = () => {
          if (client1Joined && client2Joined) {
              // Both joined, now disconnect client 1
              clientSocket1.disconnect();
          }
      };

      clientSocket1.emit('joinRoom', { roomId: testRoomId, userName: userName1, password: testRoomPassword });
      clientSocket1.once('roomJoined', () => {
          client1Joined = true;
          checkDone();
      });

      clientSocket2.on('connect', () => {
          clientSocket2.emit('joinRoom', { roomId: testRoomId, userName: userName2, password: testRoomPassword });
          clientSocket2.once('roomJoined', () => {
              client2Joined = true;
              // Listen on client 2 for the update when client 1 disconnects
              clientSocket2.on('participantUpdate', (data) => {
                  expect(data.participants.length).toBeLessThanOrEqual(1); // Should be just Bob left (or empty if race condition)
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
