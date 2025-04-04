import { createServer } from 'http';
import { io as Client } from 'socket.io-client';
import { server as httpServer, io } from '../index.js'; // Import the already configured HTTP server and io
import pool from '../db/pool.js';
import request from 'supertest'; // To create a board via API first
import { app } from '../index.js'; // Need app for supertest
import { v4 as uuidv4 } from 'uuid'; // To generate card IDs

describe('Retro Socket Events (/retro namespace)', () => {
  let clientSocket1, clientSocket2;
  let httpServerAddr;
  let testBoardId;
  let testBoardPassword = 'retroSockPassword';
  let authToken; // Needed if board creation requires auth tied to workspace
  let userId;

  // Setup: Register user, create workspace, create retro board
  beforeAll(async () => {
     // Start the HTTP server to get address and port
     await new Promise(resolve => {
        httpServer.listen(() => {
          httpServerAddr = httpServer.address();
          resolve();
        });
      });

    // Register user
    const userEmail = `retro_sock_user_${Date.now()}@example.com`;
    const userPassword = 'password123';
    const resRegister = await request(app)
      .post('/api/auth/register')
      .send({ email: userEmail, password: userPassword, name: 'Retro Sock User' });
    expect(resRegister.statusCode).toEqual(201);
    authToken = resRegister.body.token;
    userId = resRegister.body.user.id;

    // Create a retro board via API to ensure it exists
    const boardName = 'Retro Socket Test Board';
    const resBoard = await request(app)
      .post('/api/retro')
      .set('Authorization', `Bearer ${authToken}`) // Assuming auth might be needed
      .send({ name: boardName, settings: { password: testBoardPassword } }); // Create with password
    expect(resBoard.statusCode).toEqual(200);
    expect(resBoard.body.boardId).toBeDefined();
    testBoardId = resBoard.body.boardId;
  });

  // Teardown: Close server, io instance, and DB pool
  afterAll(async () => {
    clientSocket1?.close();
    clientSocket2?.close();
    io.close(); // Close Socket.IO server
    await new Promise(resolve => httpServer.close(resolve)); // Close the HTTP server
    // pool.end(); // Keep pool open for now due to potential async issues
  });

  // Connect client before each test
  beforeEach((done) => {
    const url = `http://localhost:${httpServerAddr.port}/retro`;
    clientSocket1 = Client(url, {
      reconnectionDelay: 0,
      forceNew: true,
      transports: ['websocket'],
    });
    clientSocket1.on('connect', done);
    clientSocket1.on('connect_error', (err) => done(err));
  });

  // Disconnect client after each test
  afterEach(() => {
    if (clientSocket1?.connected) {
      clientSocket1.disconnect();
    }
    if (clientSocket2?.connected) {
        clientSocket2.disconnect();
      }
  });

  // Test joining a retro board
  it('should allow a user to join a retro board', (done) => {
    const userName = 'RetroAlice';
    clientSocket1.emit('joinRetroBoard', { boardId: testBoardId, name: userName, password: testBoardPassword });

    clientSocket1.on('retroBoardJoined', (board) => {
      expect(board).toBeDefined();
      expect(board.id).toEqual(testBoardId);
      expect(board.name).toEqual('Retro Socket Test Board');
      expect(board.cards).toBeDefined();
      // Check if user name was stored (though not directly sent back in board data)
      // We'll verify this indirectly via author name on cards later
      done();
    });
    clientSocket1.on('error', (err) => done(new Error(`Join error: ${err.message}`)));
  });

  // Test adding a retro card
  it('should add a retro card and update the board', (done) => {
    const userName = 'RetroAlice';
    const cardText = 'This is a test card';
    const columnId = 'wentWell'; // Example column
    const cardId = uuidv4();

    clientSocket1.emit('joinRetroBoard', { boardId: testBoardId, name: userName, password: testBoardPassword });
    clientSocket1.once('retroBoardJoined', () => {
      clientSocket1.emit('addRetroCard', {
        boardId: testBoardId,
        cardId: cardId,
        columnId: columnId,
        text: cardText,
        authorName: userName // Client sends author name
      });

      clientSocket1.on('retroBoardUpdated', (board) => {
        expect(board).toBeDefined();
        expect(board.cards).toBeDefined();
        const addedCard = board.cards.find(card => card.id === cardId);
        expect(addedCard).toBeDefined();
        expect(addedCard.text).toEqual(cardText);
        expect(addedCard.column_id).toEqual(columnId);
        expect(addedCard.author_name).toEqual(userName);
        done();
      });
       clientSocket1.on('error', (err) => done(new Error(`Add card error: ${err.message}`)));
    });
     clientSocket1.on('error', (err) => done(new Error(`Join error: ${err.message}`)));
  });
  
  // Test editing a retro card
  it('should edit a retro card and update the board', (done) => {
      const userName = 'RetroAlice';
      const cardText = 'Initial card text';
      const editedText = 'Edited card text';
      const columnId = 'improvements';
      const cardId = uuidv4();
  
      clientSocket1.emit('joinRetroBoard', { boardId: testBoardId, name: userName, password: testBoardPassword });
      clientSocket1.once('retroBoardJoined', () => {
          // Add a card first
          clientSocket1.emit('addRetroCard', { boardId: testBoardId, cardId, columnId, text: cardText, authorName: userName });
          clientSocket1.once('retroBoardUpdated', (boardAfterAdd) => {
              // Now edit the card
              clientSocket1.emit('editRetroCard', { boardId: testBoardId, cardId, text: editedText });
  
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

  // Test deleting a retro card
  it('should delete a retro card and update the board', (done) => {
    const userName = 'RetroAlice';
    const cardText = 'Card to delete';
    const columnId = 'actionItems';
    const cardId = uuidv4();

    clientSocket1.emit('joinRetroBoard', { boardId: testBoardId, name: userName, password: testBoardPassword });
    clientSocket1.once('retroBoardJoined', () => {
        // Add card
        clientSocket1.emit('addRetroCard', { boardId: testBoardId, cardId, columnId, text: cardText, authorName: userName });
        clientSocket1.once('retroBoardUpdated', () => {
            // Delete card
            clientSocket1.emit('deleteRetroCard', { boardId: testBoardId, cardId });

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
  
   // Test toggling votes
   it('should toggle votes on a card and update the board', (done) => {
    const userName = 'RetroAlice';
    const cardText = 'Card to vote on';
    const columnId = 'wentWell';
    const cardId = uuidv4();

    clientSocket1.emit('joinRetroBoard', { boardId: testBoardId, name: userName, password: testBoardPassword });
    clientSocket1.once('retroBoardJoined', () => {
        // Add card
        clientSocket1.emit('addRetroCard', { boardId: testBoardId, cardId, columnId, text: cardText, authorName: userName });
        clientSocket1.once('retroBoardUpdated', () => {
            // Vote once
            clientSocket1.emit('toggleVote', { boardId: testBoardId, cardId });
            clientSocket1.once('retroBoardUpdated', (boardAfterVote1) => {
                const votedCard1 = boardAfterVote1.cards.find(card => card.id === cardId);
                expect(votedCard1).toBeDefined();
                expect(votedCard1.votes).toContain(userName);

                // Vote again (unvote)
                clientSocket1.emit('toggleVote', { boardId: testBoardId, cardId });
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

  // TODO: Add tests for timer events (startTimer, stopTimer, timerUpdate)
  // TODO: Add tests for visibility toggle (toggleCardsVisibility, cardsVisibilityChanged)
  // TODO: Add tests for changing name (changeRetroName)

});
