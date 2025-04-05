 import { createServer } from 'http';
import { io as Client } from 'socket.io-client';
import { server as httpServer, io, app } from '../index.js'; // Import app and io
import { pool } from '../db/pool.js';
import request from 'supertest'; 
import { v4 as uuidv4 } from 'uuid';

describe('Retro Socket Events (/retro namespace)', () => {
  let clientSocket1, clientSocket2;
  let httpServerAddr;
  let anonBoardId = `anon-retro-socket-${Date.now()}`;
  let anonBoardPassword = 'retroSockPassword';
  let publicBoardId = `public-retro-socket-${Date.now()}`;
  let authToken; // For authenticated tests
  let userId;
  let testUserName = 'Retro Sock User Auth'; // Define username for auth tests
  let createdAuthBoardId; // For authenticated tests

  // Setup: Start server, create boards via API, register user
  beforeAll(async () => {
    await new Promise(resolve => {
      httpServer.listen(() => {
        httpServerAddr = httpServer.address();
        resolve();
      });
    });

    // Create a public retro board
    const resPublic = await request(app)
      .post('/api/retro')
      .send({ name: 'Public Retro Socket Board' });
    expect(resPublic.statusCode).toEqual(200);
    publicBoardId = resPublic.body.boardId;

    // Create a password-protected anonymous board
    const resAnonPwd = await request(app)
      .post('/api/retro')
      .send({ name: 'Pwd Retro Socket Board', settings: { password: anonBoardPassword } });
    expect(resAnonPwd.statusCode).toEqual(200);
    anonBoardId = resAnonPwd.body.boardId; 

    // Register a user (for authenticated tests)
    const userEmail = `retro_sock_user_auth_${Date.now()}@example.com`;
    const userPassword = 'password123';
    const resRegister = await request(app)
      .post('/api/auth/register')
      .send({ email: userEmail, password: userPassword, name: testUserName });
    expect(resRegister.statusCode).toEqual(201);
    authToken = resRegister.body.token;
    userId = resRegister.body.user.id;
    
    // Create a board for authenticated tests (can be public or linked)
    const resAuthBoard = await request(app)
        .post('/api/retro')
        .set('Authorization', `Bearer ${authToken}`) // Use token
        .send({ name: 'Auth Retro Test Board' }); // Create a simple public board for auth tests
    expect(resAuthBoard.statusCode).toEqual(200);
    createdAuthBoardId = resAuthBoard.body.boardId;
  });

  // Teardown: Close server, io, pool
  afterAll(async () => {
    clientSocket1?.close();
    clientSocket2?.close();
    io.close();
    await new Promise(resolve => httpServer.close(resolve));
    await pool.end();
  });

  // --- Anonymous Access Tests ---
  describe('Anonymous Access', () => {
    beforeEach((done) => {
      const url = `http://localhost:${httpServerAddr.port}/retro`;
      clientSocket1 = Client(url, { forceNew: true, transports: ['websocket'] });
      clientSocket1.on('connect', done);
      clientSocket1.on('connect_error', (err) => done(err));
    });

    afterEach(() => {
      if (clientSocket1?.connected) clientSocket1.disconnect();
    });

    it('should allow joining a public board', (done) => {
      const userName = 'AnonRetroAlice';
      clientSocket1.emit('joinRetroBoard', { boardId: publicBoardId, name: userName });
      clientSocket1.on('retroBoardJoined', (board) => {
        expect(board.id).toEqual(publicBoardId);
        done();
      });
      clientSocket1.on('error', (err) => done(new Error(`Join error: ${err.message}`)));
    });

    it('should allow joining a password board with correct password', (done) => {
      const userName = 'AnonRetroBob';
      clientSocket1.emit('joinRetroBoard', { boardId: anonBoardId, name: userName, password: anonBoardPassword });
      clientSocket1.on('retroBoardJoined', (board) => {
        expect(board.id).toEqual(anonBoardId);
        done();
      });
      clientSocket1.on('error', (err) => done(new Error(`Join error: ${err.message}`)));
    });

    it('should reject joining a password board with incorrect password', (done) => {
      const userName = 'AnonRetroCharlie';
      clientSocket1.emit('joinRetroBoard', { boardId: anonBoardId, name: userName, password: 'wrongpassword' });
      clientSocket1.on('error', (err) => {
        expect(err.message).toEqual('Invalid password');
        done();
      });
      clientSocket1.on('retroBoardJoined', () => done(new Error('Should not have joined with wrong password')));
    });

    it('should reject joining a non-existent board', (done) => {
      const userName = 'AnonRetroDavid';
      clientSocket1.emit('joinRetroBoard', { boardId: 'non-existent', name: userName });
      clientSocket1.on('error', (err) => {
        expect(err.message).toEqual('Board not found');
        done();
      });
      clientSocket1.on('retroBoardJoined', () => done(new Error('Should not have joined non-existent board')));
    });

    it('should add a retro card anonymously', (done) => {
        const userName = 'AnonRetroAlice';
        const cardText = 'Anon test card';
        const columnId = 'wentWell'; 
        const cardId = uuidv4();
    
        clientSocket1.emit('joinRetroBoard', { boardId: publicBoardId, name: userName });
        clientSocket1.once('retroBoardJoined', () => {
          clientSocket1.emit('addRetroCard', { boardId: publicBoardId, cardId, columnId, text: cardText, authorName: userName });
          clientSocket1.on('retroBoardUpdated', (board) => {
            const addedCard = board.cards.find(card => card.id === cardId);
            expect(addedCard).toBeDefined();
            expect(addedCard.text).toEqual(cardText);
            done();
          });
           clientSocket1.on('error', (err) => done(new Error(`Add card error: ${err.message}`)));
        });
         clientSocket1.on('error', (err) => done(new Error(`Join error: ${err.message}`)));
      });

      it('should toggle votes anonymously', (done) => {
        const userName = 'AnonRetroAlice';
        const cardText = 'Anon card to vote on';
        const columnId = 'wentWell';
        const cardId = uuidv4();
    
        clientSocket1.emit('joinRetroBoard', { boardId: publicBoardId, name: userName });
        clientSocket1.once('retroBoardJoined', () => {
            clientSocket1.emit('addRetroCard', { boardId: publicBoardId, cardId, columnId, text: cardText, authorName: userName });
            clientSocket1.once('retroBoardUpdated', () => {
                clientSocket1.emit('toggleVote', { boardId: publicBoardId, cardId });
                clientSocket1.once('retroBoardUpdated', (boardAfterVote1) => {
                    const votedCard1 = boardAfterVote1.cards.find(card => card.id === cardId);
                    expect(votedCard1).toBeDefined();
                    expect(votedCard1.votes).toContain(userName);
                    // Toggle back
                    clientSocket1.emit('toggleVote', { boardId: publicBoardId, cardId });
                     clientSocket1.once('retroBoardUpdated', (boardAfterVote2) => {
                        const votedCard2 = boardAfterVote2.cards.find(card => card.id === cardId);
                        expect(votedCard2).toBeDefined();
                        expect(votedCard2.votes).not.toContain(userName);
                        done();
                    });
                });
            });
             clientSocket1.on('error', (err) => done(new Error(`Vote/Add card error: ${err.message}`)));
        });
         clientSocket1.on('error', (err) => done(new Error(`Join error: ${err.message}`)));
      });
      
      // Add anonymous tests for edit, delete, change name, timer, visibility
       it('should edit a retro card anonymously', (done) => {
        const userName = 'AnonRetroAlice';
        const cardText = 'Initial anon text';
        const editedText = 'Edited anon text';
        const columnId = 'improvements';
        const cardId = uuidv4();
    
        clientSocket1.emit('joinRetroBoard', { boardId: publicBoardId, name: userName });
        clientSocket1.once('retroBoardJoined', () => {
            clientSocket1.emit('addRetroCard', { boardId: publicBoardId, cardId, columnId, text: cardText, authorName: userName });
            clientSocket1.once('retroBoardUpdated', () => {
                clientSocket1.emit('editRetroCard', { boardId: publicBoardId, cardId, text: editedText });
                clientSocket1.once('retroBoardUpdated', (boardAfterEdit) => {
                    const editedCard = boardAfterEdit.cards.find(card => card.id === cardId);
                    expect(editedCard).toBeDefined();
                    expect(editedCard.text).toEqual(editedText);
                    done();
                });
            });
             clientSocket1.on('error', (err) => done(new Error(`Edit/Add card error: ${err.message}`)));
        });
         clientSocket1.on('error', (err) => done(new Error(`Join error: ${err.message}`)));
    });

    it('should delete a retro card anonymously', (done) => {
        const userName = 'AnonRetroAlice';
        const cardText = 'Anon card to delete';
        const columnId = 'actionItems';
        const cardId = uuidv4();
    
        clientSocket1.emit('joinRetroBoard', { boardId: publicBoardId, name: userName });
        clientSocket1.once('retroBoardJoined', () => {
            clientSocket1.emit('addRetroCard', { boardId: publicBoardId, cardId, columnId, text: cardText, authorName: userName });
            clientSocket1.once('retroBoardUpdated', () => {
                clientSocket1.emit('deleteRetroCard', { boardId: publicBoardId, cardId });
                clientSocket1.once('retroBoardUpdated', (boardAfterDelete) => {
                    const deletedCard = boardAfterDelete.cards.find(card => card.id === cardId);
                    expect(deletedCard).toBeUndefined();
                    done();
                });
            });
             clientSocket1.on('error', (err) => done(new Error(`Delete/Add card error: ${err.message}`)));
        });
         clientSocket1.on('error', (err) => done(new Error(`Join error: ${err.message}`)));
      });

    it('should toggle cards visibility and notify clients', (done) => {
      const userName1 = 'AnonVisUser1';
      const userName2 = 'AnonVisUser2';
      const url = `http://localhost:${httpServerAddr.port}/retro`;
      
      let client1Joined = false;
      let client2Joined = false;
      let client1ReceivedToggle = false;
      let client2ReceivedToggle = false;
      let toggleEmitted = false;

      // Need a second client socket instance
      const clientSocket2 = Client(url, { forceNew: true, transports: ['websocket'] });

      const attemptToggle = () => {
        // Only emit toggle once both clients are confirmed joined
        if (client1Joined && client2Joined && !toggleEmitted) {
          toggleEmitted = true;
          clientSocket1.emit('toggleCardsVisibility', { boardId: publicBoardId, hideCards: true });
        }
      };

      const checkDone = () => {
        // Ensure the test completes only after both clients received the toggled state
        if (client1ReceivedToggle && client2ReceivedToggle) {
          clientSocket2.disconnect(); // Disconnect second client
          done();
        }
      };

      // Setup listeners BEFORE joining
      clientSocket1.on('cardsVisibilityChanged', ({ hideCards }) => {
        // Only process this event if the toggle has actually been emitted
        if (toggleEmitted) {
          expect(hideCards).toBe(true); // Expect true after toggle
          client1ReceivedToggle = true;
          checkDone();
        }
      });

      clientSocket2.on('cardsVisibilityChanged', ({ hideCards }) => {
        if (toggleEmitted) {
          expect(hideCards).toBe(true); // Expect true after toggle
          client2ReceivedToggle = true;
          checkDone();
        }
      });

      // Handle errors
      clientSocket1.on('error', (err) => done(new Error(`Client 1 error: ${err.message}`)));
      clientSocket2.on('error', (err) => done(new Error(`Client 2 error: ${err.message}`)));
      clientSocket2.on('connect_error', (err) => done(err));


      // Join clients
      clientSocket1.emit('joinRetroBoard', { boardId: publicBoardId, name: userName1 });
      clientSocket1.once('retroBoardJoined', () => {
        client1Joined = true;
        attemptToggle(); // Attempt toggle after client 1 joins
      });

      clientSocket2.on('connect', () => {
          clientSocket2.emit('joinRetroBoard', { boardId: publicBoardId, name: userName2 });
          clientSocket2.once('retroBoardJoined', () => {
            client2Joined = true;
            attemptToggle(); // Attempt toggle after client 2 joins
          });
      });
    });

    it('should update board settings', (done) => {
      const userName = 'AnonSettingsUser';
      const newSettings = { defaultTimer: 900, hideAuthorNames: true }; // Use camelCase keys

      clientSocket1.emit('joinRetroBoard', { boardId: publicBoardId, name: userName });
      clientSocket1.once('retroBoardJoined', () => {
        clientSocket1.emit('updateSettings', { boardId: publicBoardId, settings: newSettings });
        clientSocket1.once('retroBoardUpdated', (board) => {
          expect(board.default_timer).toEqual(newSettings.defaultTimer); // Compare DB snake_case with test camelCase
          expect(board.hide_author_names).toEqual(newSettings.hideAuthorNames); // Compare DB snake_case with test camelCase
          done();
        });
        clientSocket1.on('error', (err) => done(new Error(`Update settings error: ${err.message}`)));
      });
      clientSocket1.on('error', (err) => done(new Error(`Join error: ${err.message}`)));
    });

    it('should change user name and update card author', (done) => {
      const initialName = 'AnonChangeNameBefore';
      const newName = 'AnonChangeNameAfter';
      const cardText = 'Card before name change';
      const columnId = 'wentWell';
      const cardId = uuidv4();

      clientSocket1.emit('joinRetroBoard', { boardId: publicBoardId, name: initialName });
      clientSocket1.once('retroBoardJoined', () => {
        // Add a card first
        clientSocket1.emit('addRetroCard', { boardId: publicBoardId, cardId, columnId, text: cardText, authorName: initialName });
        clientSocket1.once('retroBoardUpdated', () => {
          // Now change the name
          clientSocket1.emit('changeRetroName', { boardId: publicBoardId, newName });
          clientSocket1.once('retroBoardUpdated', (updatedBoard) => {
            const updatedCard = updatedBoard.cards.find(c => c.id === cardId);
            expect(updatedCard).toBeDefined();
            // Check if the card author name was updated (as per server logic)
            expect(updatedCard.author_name).toEqual(newName);
            // Optional: Check if user list reflects the change if available
            done();
          });
        });
        clientSocket1.on('error', (err) => done(new Error(`Change name/add card error: ${err.message}`)));
      });
      clientSocket1.on('error', (err) => done(new Error(`Join error: ${err.message}`)));
    });

    it('should start, update, and stop the timer', (done) => {
      const userName = 'AnonTimerUser';
      let timerStartedReceived = false;
      let timerUpdateReceived = false;

      clientSocket1.emit('joinRetroBoard', { boardId: publicBoardId, name: userName });
      clientSocket1.once('retroBoardJoined', (board) => {
        const defaultTimer = board.default_timer || 600; // Use board's default or fallback

        clientSocket1.emit('startTimer', { boardId: publicBoardId });

        clientSocket1.on('timerStarted', ({ timeLeft }) => {
          expect(timeLeft).toEqual(defaultTimer);
          timerStartedReceived = true;
        });

        clientSocket1.on('timerUpdate', ({ timeLeft }) => {
          expect(timeLeft).toBeLessThan(defaultTimer);
          timerUpdateReceived = true;
          // Once we get an update, try stopping it
          clientSocket1.emit('stopTimer', { boardId: publicBoardId });
        });

        clientSocket1.on('timerStopped', () => {
          expect(timerStartedReceived).toBe(true);
          expect(timerUpdateReceived).toBe(true); // Ensure we got at least one update
          // Clean up listeners to prevent interference
          clientSocket1.off('timerStarted');
          clientSocket1.off('timerUpdate');
          clientSocket1.off('timerStopped');
          done();
        });

        clientSocket1.on('error', (err) => done(new Error(`Timer operation error: ${err.message}`)));
      });
      clientSocket1.on('error', (err) => done(new Error(`Join error: ${err.message}`)));
    }, 10000); // Increase timeout for timer test

  });

  // --- Authenticated Access Tests ---
  describe('Authenticated Access', () => {
      // We already have authToken, userId, testUserName from the top-level beforeAll
      
      beforeEach((done) => {
        const url = `http://localhost:${httpServerAddr.port}/retro`;
        clientSocket1 = Client(url, { 
            forceNew: true, 
            transports: ['websocket'],
            // auth: { token: authToken } // Pass token if needed
        });
        clientSocket1.on('connect', done);
        clientSocket1.on('connect_error', (err) => done(err));
      });
  
      afterEach(() => {
        if (clientSocket1?.connected) clientSocket1.disconnect();
      });

      it('should allow an authenticated user to join a board', (done) => {
        const userName = testUserName; // Use name from registered user
        clientSocket1.emit('joinRetroBoard', { boardId: createdAuthBoardId, name: userName }); 
        clientSocket1.on('retroBoardJoined', (board) => {
          expect(board.id).toEqual(createdAuthBoardId);
          done();
        });
        clientSocket1.on('error', (err) => done(new Error(`Join error: ${err.message}`)));
      });

       it('should allow an authenticated user to add a card', (done) => {
        const userName = testUserName;
        const cardText = 'Auth test card';
        const columnId = 'actionItems'; 
        const cardId = uuidv4();
    
        clientSocket1.emit('joinRetroBoard', { boardId: createdAuthBoardId, name: userName });
        clientSocket1.once('retroBoardJoined', () => {
          clientSocket1.emit('addRetroCard', { boardId: createdAuthBoardId, cardId, columnId, text: cardText, authorName: userName });
          clientSocket1.on('retroBoardUpdated', (board) => {
            const addedCard = board.cards.find(card => card.id === cardId);
            expect(addedCard).toBeDefined();
            expect(addedCard.author_name).toEqual(userName); 
            done();
          });
           clientSocket1.on('error', (err) => done(new Error(`Add card error: ${err.message}`)));
        });
         clientSocket1.on('error', (err) => done(new Error(`Join error: ${err.message}`)));
      });
      
      // Add more authenticated tests here if needed
  });
});
