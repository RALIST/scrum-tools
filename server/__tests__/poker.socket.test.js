import { io as Client } from 'socket.io-client';
import { server as httpServer, io, app } from '../index.js'; // Import app and io
import { pool } from '../db/pool.js';
import request from 'supertest';
// Import Jest functions
import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';


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
      .send({ roomId: publicRoomId, name: 'Public Poker Socket Room', sequence: 'fibonacci' }); // Provide sequence key
    expect(resPublic.statusCode).toEqual(200);

    // Create a password-protected room
    const resPwd = await request(app)
      .post('/api/poker/rooms')
      .send({ roomId: testRoomId, name: 'Pwd Poker Socket Room', password: testRoomPassword, sequence: 'tshirt' }); // Provide sequence key
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
    await pool.end(); // Close the database pool
  });

  // --- Anonymous Access Tests ---
  describe('Anonymous Access', () => {
    beforeEach((done) => {
      const url = `http://localhost:${httpServerAddr.port}/poker`;
      clientSocket1 = Client(url, { forceNew: true, transports: ['websocket'] });
      clientSocket1.on('connect', done);
      clientSocket1.on('connect_error', (err) => done(err)); // Fail test on connect error
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
        expect(data.settings.sequence).toEqual('fibonacci'); // Check sequence key
        done();
      });
      clientSocket1.on('error', (err) => done(new Error(`Join error: ${err.message}`)));
    });

    it('should allow joining a password room with correct password', (done) => {
      const userName = 'AnonBob';
      clientSocket1.emit('joinRoom', { roomId: testRoomId, userName, password: testRoomPassword });
      clientSocket1.on('roomJoined', (data) => {
        expect(data.participants.some(p => p.name === userName)).toBe(true);
        expect(data.settings.sequence).toEqual('tshirt'); // Check sequence key
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

    it('should allow joining a public room even if password provided (ignored)', (done) => {
      const userName = 'AnonEve';
      clientSocket1.emit('joinRoom', { roomId: publicRoomId, userName, password: 'somepassword' });
      clientSocket1.on('roomJoined', (data) => {
        expect(data.participants.some(p => p.name === userName)).toBe(true);
        done();
      });
      clientSocket1.on('error', (err) => done(new Error(`Should have joined public room, but got error: ${err.message}`)));
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
                expect(participant.vote).toEqual(voteValue); // Check vote value
                done();
            });
             clientSocket1.on('error', (err) => done(new Error(`Vote error: ${err.message}`)));
        });
         clientSocket1.on('error', (err) => done(new Error(`Join error: ${err.message}`)));
      });

    it('should handle error during vote (e.g., invalid room)', (done) => {
      const voteValue = '8';
      // Don't join a room first
      clientSocket1.emit('vote', { roomId: 'non-existent-room', vote: voteValue });
      expect.assertions(1); // Expect the assertion in the listener to run

      clientSocket1.on('error', (err) => {

        expect(err.message).toEqual('Failed to record vote');

        done();
      });
      // Rely on Jest's default timeout
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

    it('should handle error during resetVotes (e.g., invalid room)', (done) => {
      // Don't join a room first
      clientSocket1.emit('resetVotes', { roomId: 'non-existent-room' });
      expect.assertions(1); // Expect the assertion in the listener to run

      clientSocket1.on('error', (err) => {

        expect(err.message).toEqual('Failed to reset votes'); // Reverted expectation

        done();
      });
      // Rely on Jest's default timeout
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

    it('should handle error during changeName (e.g., invalid room)', (done) => {
      const initialName = 'AnonAliceFail';
      const newName = 'AnonAliceFail B.';
      // Don't join a room first
      clientSocket1.emit('changeName', { roomId: 'non-existent-room', newName: newName });
       // Expect the assertion in the listener to run

      clientSocket1.on('error', (err) => {

        expect(err.message).toEqual('Failed to change name');

        done();
        // Removed duplicate done() call
      });
      // Rely on Jest's default timeout
    });

    it('should update room settings (sequence and password)', async () => { // Made async for await request
      const userName = 'AnonSettingsUser';
      const newSequenceKey = "tshirt"; // Send key
      const newPassword = 'newPokerPassword';
      const testSpecificRoomId = `settings-test-${Date.now()}`; // Unique ID for this test

      // Create the room via API
      const resCreate = await request(app)
        .post('/api/poker/rooms')
        .send({ roomId: testSpecificRoomId, name: 'Isolated Settings Test Room', sequence: 'fibonacci' }); // Start with fibonacci
      expect(resCreate.statusCode).toEqual(200);

      await new Promise((resolve, reject) => {
        clientSocket1.emit('joinRoom', { roomId: testSpecificRoomId, userName }); // Use unique room ID

        clientSocket1.once('roomJoined', () => {
          clientSocket1.emit('updateSettings', { // Use unique room ID
            roomId: testSpecificRoomId,
            settings: { sequence: newSequenceKey, password: newPassword } // Send key
          });

          clientSocket1.on('settingsUpdated', (data) => {
            try {
              expect(data.settings.sequence).toEqual(newSequenceKey); // Expect key back
              expect(data.settings.hasPassword).toBe(true);
              resolve(); // Test passed
            } catch (e) {
              reject(e); // Assertion failed
            }
          });
          clientSocket1.on('error', (err) => reject(new Error(`Update settings error: ${err.message}`)));
        });
        clientSocket1.on('error', (err) => reject(new Error(`Join error: ${err.message}`)));
      });
    });

    // Test for invalid sequence key
    it('should handle updateSettings with invalid sequence key (no error, returns invalid key)', async () => {
      const userName = 'AnonSettingsErrorUser';
      const invalidKey = 'invalid-key';
      const invalidSettings = { sequence: invalidKey }; // Invalid key
      const testSpecificRoomId = `settings-error-test-${Date.now()}`; // Unique ID
      const originalSequenceKey = 'fibonacci';

      // Create the room via API
      const resCreate = await request(app)
        .post('/api/poker/rooms')
        .send({ roomId: testSpecificRoomId, name: 'Isolated Settings Error Test Room', sequence: originalSequenceKey });
      expect(resCreate.statusCode).toEqual(200);


      await new Promise((resolve, reject) => {
        let errorTimeout; // To store the timeout ID

        const errorHandler = (err) => {
          clearTimeout(errorTimeout); // Clear the timeout if error is received
          // Clean up listeners before rejecting
          clientSocket1.off('error', errorHandler);
          clientSocket1.off('settingsUpdated', settingsUpdatedHandler);
          reject(new Error(`Received unexpected error: ${err.message}`)); // Fail on any error
        };

        const settingsUpdatedHandler = (data) => {
          clearTimeout(errorTimeout); // Clear timeout
          // Clean up listeners before resolving
          clientSocket1.off('error', errorHandler);
          clientSocket1.off('settingsUpdated', settingsUpdatedHandler);
           try {
                // Expect the sequence to have been updated to the invalid key
                expect(data.settings.sequence).toEqual(invalidKey); // Expect invalid key back
                resolve(); // Test passed
            } catch (e) {
                reject(e);
            }
        };

        // Listen for settingsUpdated OR error
        clientSocket1.on('error', errorHandler);
        clientSocket1.on('settingsUpdated', settingsUpdatedHandler);

        clientSocket1.emit('joinRoom', { roomId: testSpecificRoomId, userName }); // Use unique room ID
        clientSocket1.once('roomJoined', () => {
          // Send invalid settings immediately after joining
          clientSocket1.emit('updateSettings', {
            roomId: testSpecificRoomId, // Use unique room ID
            settings: invalidSettings
          });
          // Add a timeout to fail the test if neither event is received
          errorTimeout = setTimeout(() => {
              // Clean up listeners before failing
              clientSocket1.off('error', errorHandler);
              clientSocket1.off('settingsUpdated', settingsUpdatedHandler);
              reject(new Error('Timeout waiting for settingsUpdated/error event after invalid key'));
          }, 1500); // Increased timeout slightly
        });

         // Handle potential join errors separately
         clientSocket1.on('connect_error', (err) => reject(err));
         // Only reject on join error if the main error handler isn't active
         clientSocket1.on('error', (err) => {
             if (!errorHandler) { // Check if the specific error handler is attached
                 reject(new Error(`Join error: ${err.message}`));
             }
         });
      });
    });

    // --- NEW TEST: Invalid password type ---
    it('should ignore invalid password type during updateSettings', async () => {
        const userName = 'AnonSettingsPwdTypeErrorUser';
        const invalidSettings = { password: 12345 }; // Invalid type
        const testSpecificRoomId = `settings-pwd-type-test-${Date.now()}`;

        // Create the room via API
        const resCreate = await request(app)
            .post('/api/poker/rooms')
            .send({ roomId: testSpecificRoomId, name: 'Isolated Pwd Type Test Room', sequence: 'fibonacci' });
        expect(resCreate.statusCode).toEqual(200);

        await new Promise((resolve, reject) => {
            let errorTimeout;

            const errorHandler = (err) => {
                clearTimeout(errorTimeout);
                clientSocket1.off('error', errorHandler);
                clientSocket1.off('settingsUpdated', settingsUpdatedHandler);
                reject(new Error(`Received unexpected error: ${err.message}`)); // Fail on any error
            };

            const settingsUpdatedHandler = (data) => {
                clearTimeout(errorTimeout);
                 clientSocket1.off('error', errorHandler);
                 clientSocket1.off('settingsUpdated', settingsUpdatedHandler);
                try {
                    // Expect password status NOT to have changed (still false)
                    expect(data.settings.hasPassword).toBe(false);
                    resolve(); // Test passed
                } catch (e) {
                    reject(e);
                }
            };

            clientSocket1.on('error', errorHandler);
            clientSocket1.on('settingsUpdated', settingsUpdatedHandler);

            clientSocket1.emit('joinRoom', { roomId: testSpecificRoomId, userName });
            clientSocket1.once('roomJoined', () => {
                clientSocket1.emit('updateSettings', {
                    roomId: testSpecificRoomId,
                    settings: invalidSettings
                });
                errorTimeout = setTimeout(() => {
                    clientSocket1.off('error', errorHandler);
                    clientSocket1.off('settingsUpdated', settingsUpdatedHandler);
                    reject(new Error('Timeout waiting for settingsUpdated event after invalid password type'));
                }, 1500);
            });
             clientSocket1.on('connect_error', (err) => reject(err));
        });
    });
    // --- END NEW TEST ---


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
            // auth: { token: authToken } // Keep commented as backend doesn't use socket auth
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

  // --- Disconnect Test (Moved Inside Main Describe) ---
  it('should handle disconnect gracefully even if user did not join a room', (done) => {
    const url = `http://localhost:${httpServerAddr.port}/poker`;
    const tempSocket = Client(url, { forceNew: true, transports: ['websocket'] });

    tempSocket.on('connect', () => {
        // Immediately disconnect without joining
        tempSocket.disconnect();
        // We can't easily assert server-side logs here,
        // but we can check that the disconnect doesn't crash the server.
        // The test passes if done() is called without errors.
        // Add a small delay to allow server-side disconnect logic to run.
        setTimeout(done, 200);
    });

    tempSocket.on('connect_error', (err) => done(err));
    tempSocket.on('error', (err) => done(new Error(`Unexpected socket error: ${err.message}`)));
  });
  // --- End Disconnect Test ---

}); // End of main describe block
