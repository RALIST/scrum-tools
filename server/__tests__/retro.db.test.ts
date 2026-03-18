import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

import * as retroDb from '../db/retro.js';
import { pool } from '../db/pool.js';
import { executeQuery } from '../db/dbUtils.js';
import * as usersDb from '../db/users.js';
import * as workspacesDb from '../db/workspaces.js';

describe('Retro DB Functions (server/db/retro.js)', () => {

    beforeEach(async () => {
        await executeQuery('TRUNCATE TABLE retro_card_votes RESTART IDENTITY CASCADE;');
        await executeQuery('TRUNCATE TABLE retro_cards RESTART IDENTITY CASCADE;');
        await executeQuery('TRUNCATE TABLE retro_boards RESTART IDENTITY CASCADE;');
        await executeQuery('TRUNCATE TABLE workspace_members RESTART IDENTITY CASCADE;');
        await executeQuery('TRUNCATE TABLE teams RESTART IDENTITY CASCADE;');
        await executeQuery('TRUNCATE TABLE workspaces RESTART IDENTITY CASCADE;');
        await executeQuery('TRUNCATE TABLE users RESTART IDENTITY CASCADE;');
    });

    afterAll(async () => {
        if (pool) await pool.end();
    });

    // --- createRetroBoard ---
    describe('createRetroBoard', () => {
        it('should create a board with default settings', async () => {
            const boardId = uuidv4();
            await retroDb.createRetroBoard(boardId, 'Default Board', null);

            const result = await executeQuery('SELECT * FROM retro_boards WHERE id = $1', [boardId]);
            expect(result.rows).toHaveLength(1);

            const board = result.rows[0];
            expect(board.id).toBe(boardId);
            expect(board.name).toBe('Default Board');
            expect(board.timer_running).toBe(false);
            expect(board.time_left).toBe(300);
            expect(board.default_timer).toBe(300);
            expect(board.hide_cards_by_default).toBe(false);
            expect(board.hide_author_names).toBe(false);
            expect(board.password).toBeNull();
            expect(board.workspace_id).toBeNull();
        });

        it('should create a board with custom settings (timer, password)', async () => {
            const boardId = uuidv4();
            await retroDb.createRetroBoard(boardId, 'Custom Board', null, {
                defaultTimer: 600,
                hideCardsByDefault: true,
                hideAuthorNames: true,
                password: 'secret123',
            });

            const result = await executeQuery('SELECT * FROM retro_boards WHERE id = $1', [boardId]);
            expect(result.rows).toHaveLength(1);

            const board = result.rows[0];
            expect(board.time_left).toBe(600);
            expect(board.default_timer).toBe(600);
            expect(board.hide_cards_by_default).toBe(true);
            expect(board.hide_author_names).toBe(true);
            expect(board.password).toBeDefined();
            expect(board.password).not.toBeNull();
            // Verify it's a bcrypt hash
            const isMatch = await bcrypt.compare('secret123', board.password);
            expect(isMatch).toBe(true);
        });

        it('should create a board linked to a workspace', async () => {
            const owner = await usersDb.createUser('retro-owner@test.com', 'pass', 'Owner');
            const ws = await workspacesDb.createWorkspace('Retro WS', 'desc', owner.id);

            const boardId = uuidv4();
            await retroDb.createRetroBoard(boardId, 'WS Board', ws.id);

            const result = await executeQuery('SELECT workspace_id FROM retro_boards WHERE id = $1', [boardId]);
            expect(result.rows[0].workspace_id).toBe(ws.id);
        });

        it('should use boardId as name when name is undefined', async () => {
            const boardId = uuidv4();
            await retroDb.createRetroBoard(boardId, undefined, null);

            const result = await executeQuery('SELECT name FROM retro_boards WHERE id = $1', [boardId]);
            expect(result.rows[0].name).toBe(boardId);
        });
    });

    // --- getRetroBoard ---
    describe('getRetroBoard', () => {
        it('should return board with cards and votes', async () => {
            const boardId = uuidv4();
            await retroDb.createRetroBoard(boardId, 'Detail Board', null);

            const cardId = uuidv4();
            await retroDb.addRetroCard(boardId, cardId, 'went-well', 'Great sprint!', 'Alice');
            await retroDb.toggleRetroCardVote(cardId, 'Alice');
            await retroDb.toggleRetroCardVote(cardId, 'Bob');

            const board = await retroDb.getRetroBoard(boardId);

            expect(board).toBeDefined();
            expect(board!.id).toBe(boardId);
            expect(board!.name).toBe('Detail Board');
            expect(board!.cards).toHaveLength(1);
            expect(board!.cards[0].id).toBe(cardId);
            expect(board!.cards[0].text).toBe('Great sprint!');
            expect(board!.cards[0].column_id).toBe('went-well');
            expect(board!.cards[0].author_name).toBe('Alice');
            expect(board!.cards[0].votes).toEqual(expect.arrayContaining(['Alice', 'Bob']));
            expect(board!.cards[0].votes).toHaveLength(2);
        });

        it('should return null for non-existent board', async () => {
            const board = await retroDb.getRetroBoard('non-existent-board');
            expect(board).toBeNull();
        });

        it('should NOT include password hash in result', async () => {
            const boardId = uuidv4();
            await retroDb.createRetroBoard(boardId, 'Secure Board', null, {
                password: 'secret',
            });

            const board = await retroDb.getRetroBoard(boardId);

            expect(board).toBeDefined();
            expect(board!.hasPassword).toBe(true);
            // The password field should be excluded from the returned object
            expect((board as unknown as Record<string, unknown>)['password']).toBeUndefined();
        });

        it('should return board with empty cards array when no cards exist', async () => {
            const boardId = uuidv4();
            await retroDb.createRetroBoard(boardId, 'Empty Card Board', null);

            const board = await retroDb.getRetroBoard(boardId);

            expect(board).toBeDefined();
            expect(board!.cards).toEqual([]);
        });
    });

    // --- getWorkspaceRetroBoards ---
    describe('getWorkspaceRetroBoards', () => {
        it('should return boards for a workspace', async () => {
            const owner = await usersDb.createUser('retro-ws-owner@test.com', 'pass', 'Owner');
            const ws = await workspacesDb.createWorkspace('Retro WS Boards', 'desc', owner.id);

            const board1Id = uuidv4();
            const board2Id = uuidv4();
            await retroDb.createRetroBoard(board1Id, 'WS Board 1', ws.id);
            await retroDb.createRetroBoard(board2Id, 'WS Board 2', ws.id);

            // Add a card to board1 to verify card_count
            await retroDb.addRetroCard(board1Id, uuidv4(), 'went-well', 'Test card', 'Alice');

            const boards = await retroDb.getWorkspaceRetroBoards(ws.id);

            expect(boards).toHaveLength(2);
            // Boards ordered by created_at DESC, so board2 should be first
            const board1 = boards.find(b => b.id === board1Id);
            const board2 = boards.find(b => b.id === board2Id);
            expect(board1).toBeDefined();
            expect(board2).toBeDefined();
            expect(Number(board1!.card_count)).toBe(1);
            expect(Number(board2!.card_count)).toBe(0);
            // Password should not be included
            expect(board1!.password).toBeUndefined();
        });

        it('should return empty array for workspace with no boards', async () => {
            const owner = await usersDb.createUser('retro-ws-empty@test.com', 'pass', 'Owner');
            const ws = await workspacesDb.createWorkspace('Empty Retro WS', 'desc', owner.id);

            const boards = await retroDb.getWorkspaceRetroBoards(ws.id);
            expect(boards).toEqual([]);
        });
    });

    // --- addRetroCard ---
    describe('addRetroCard', () => {
        it('should add a card to a board', async () => {
            const boardId = uuidv4();
            await retroDb.createRetroBoard(boardId, 'Card Board', null);

            const cardId = uuidv4();
            await retroDb.addRetroCard(boardId, cardId, 'to-improve', 'Need more testing', 'Bob');

            const result = await executeQuery('SELECT * FROM retro_cards WHERE id = $1', [cardId]);
            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].board_id).toBe(boardId);
            expect(result.rows[0].column_id).toBe('to-improve');
            expect(result.rows[0].text).toBe('Need more testing');
            expect(result.rows[0].author_name).toBe('Bob');
        });
    });

    // --- updateRetroCardText ---
    describe('updateRetroCardText', () => {
        it('should update card text', async () => {
            const boardId = uuidv4();
            await retroDb.createRetroBoard(boardId, 'Update Text Board', null);
            const cardId = uuidv4();
            await retroDb.addRetroCard(boardId, cardId, 'went-well', 'Original text', 'Alice');

            await retroDb.updateRetroCardText(cardId, 'Updated text');

            const result = await executeQuery('SELECT text FROM retro_cards WHERE id = $1', [cardId]);
            expect(result.rows[0].text).toBe('Updated text');
        });
    });

    // --- updateRetroCardAuthor ---
    describe('updateRetroCardAuthor', () => {
        it('should update card author', async () => {
            const boardId = uuidv4();
            await retroDb.createRetroBoard(boardId, 'Update Author Board', null);
            const cardId = uuidv4();
            await retroDb.addRetroCard(boardId, cardId, 'went-well', 'Some text', 'OldAuthor');

            await retroDb.updateRetroCardAuthor(cardId, 'NewAuthor');

            const result = await executeQuery('SELECT author_name FROM retro_cards WHERE id = $1', [cardId]);
            expect(result.rows[0].author_name).toBe('NewAuthor');
        });
    });

    // --- deleteRetroCard ---
    describe('deleteRetroCard', () => {
        it('should remove a card', async () => {
            const boardId = uuidv4();
            await retroDb.createRetroBoard(boardId, 'Delete Card Board', null);
            const cardId = uuidv4();
            await retroDb.addRetroCard(boardId, cardId, 'went-well', 'To delete', 'Alice');

            await retroDb.deleteRetroCard(cardId);

            const result = await executeQuery('SELECT * FROM retro_cards WHERE id = $1', [cardId]);
            expect(result.rows).toHaveLength(0);
        });
    });

    // --- toggleRetroCardVote ---
    describe('toggleRetroCardVote', () => {
        it('should add a vote if it does not exist', async () => {
            const boardId = uuidv4();
            await retroDb.createRetroBoard(boardId, 'Vote Board', null);
            const cardId = uuidv4();
            await retroDb.addRetroCard(boardId, cardId, 'went-well', 'Voteable', 'Alice');

            await retroDb.toggleRetroCardVote(cardId, 'Bob');

            const result = await executeQuery(
                'SELECT * FROM retro_card_votes WHERE card_id = $1 AND user_name = $2',
                [cardId, 'Bob']
            );
            expect(result.rows).toHaveLength(1);
        });

        it('should remove a vote if it already exists', async () => {
            const boardId = uuidv4();
            await retroDb.createRetroBoard(boardId, 'Vote Board 2', null);
            const cardId = uuidv4();
            await retroDb.addRetroCard(boardId, cardId, 'went-well', 'Voteable 2', 'Alice');

            // Add vote
            await retroDb.toggleRetroCardVote(cardId, 'Bob');
            // Verify it exists
            let result = await executeQuery(
                'SELECT * FROM retro_card_votes WHERE card_id = $1 AND user_name = $2',
                [cardId, 'Bob']
            );
            expect(result.rows).toHaveLength(1);

            // Toggle again to remove
            await retroDb.toggleRetroCardVote(cardId, 'Bob');

            result = await executeQuery(
                'SELECT * FROM retro_card_votes WHERE card_id = $1 AND user_name = $2',
                [cardId, 'Bob']
            );
            expect(result.rows).toHaveLength(0);
        });
    });

    // --- verifyRetroBoardPassword ---
    describe('verifyRetroBoardPassword', () => {
        it('should return true for correct password', async () => {
            const boardId = uuidv4();
            await retroDb.createRetroBoard(boardId, 'Pass Board', null, {
                password: 'mysecret',
            });

            const result = await retroDb.verifyRetroBoardPassword(boardId, 'mysecret');
            expect(result).toBe(true);
        });

        it('should return false for wrong password', async () => {
            const boardId = uuidv4();
            await retroDb.createRetroBoard(boardId, 'Pass Board 2', null, {
                password: 'mysecret',
            });

            const result = await retroDb.verifyRetroBoardPassword(boardId, 'wrongpassword');
            expect(result).toBe(false);
        });

        it('should return true for board with no password when no password given', async () => {
            const boardId = uuidv4();
            await retroDb.createRetroBoard(boardId, 'No Pass Board', null);

            const result = await retroDb.verifyRetroBoardPassword(boardId);
            expect(result).toBe(true);
        });

        it('should return false for board with no password when a password is given', async () => {
            const boardId = uuidv4();
            await retroDb.createRetroBoard(boardId, 'No Pass Board 2', null);

            const result = await retroDb.verifyRetroBoardPassword(boardId, 'somepassword');
            expect(result).toBe(false);
        });

        it('should return false for non-existent board', async () => {
            const result = await retroDb.verifyRetroBoardPassword('non-existent', 'pass');
            expect(result).toBe(false);
        });

        it('should return false for board with password when no password is given', async () => {
            const boardId = uuidv4();
            await retroDb.createRetroBoard(boardId, 'Pass Board 3', null, {
                password: 'mysecret',
            });

            const result = await retroDb.verifyRetroBoardPassword(boardId);
            expect(result).toBe(false);
        });
    });

    // --- updateRetroBoardSettings ---
    describe('updateRetroBoardSettings', () => {
        it('should update selected settings', async () => {
            const boardId = uuidv4();
            await retroDb.createRetroBoard(boardId, 'Settings Board', null);

            await retroDb.updateRetroBoardSettings(boardId, {
                defaultTimer: 120,
                hideCardsByDefault: true,
            });

            const result = await executeQuery(
                'SELECT default_timer, hide_cards_by_default, hide_author_names FROM retro_boards WHERE id = $1',
                [boardId]
            );
            expect(result.rows[0].default_timer).toBe(120);
            expect(result.rows[0].hide_cards_by_default).toBe(true);
            expect(result.rows[0].hide_author_names).toBe(false); // unchanged
        });

        it('should update password setting', async () => {
            const boardId = uuidv4();
            await retroDb.createRetroBoard(boardId, 'Settings Board 2', null);

            await retroDb.updateRetroBoardSettings(boardId, {
                password: 'newpass',
            });

            const result = await executeQuery('SELECT password FROM retro_boards WHERE id = $1', [boardId]);
            expect(result.rows[0].password).not.toBeNull();
            const isMatch = await bcrypt.compare('newpass', result.rows[0].password);
            expect(isMatch).toBe(true);
        });

        it('should remove password when set to null', async () => {
            const boardId = uuidv4();
            await retroDb.createRetroBoard(boardId, 'Settings Board 3', null, {
                password: 'existing',
            });

            await retroDb.updateRetroBoardSettings(boardId, {
                password: null,
            });

            const result = await executeQuery('SELECT password FROM retro_boards WHERE id = $1', [boardId]);
            expect(result.rows[0].password).toBeNull();
        });

        it('should do nothing when empty settings are provided', async () => {
            const boardId = uuidv4();
            await retroDb.createRetroBoard(boardId, 'Settings Board 4', null, {
                defaultTimer: 600,
            });

            await retroDb.updateRetroBoardSettings(boardId, {});

            const result = await executeQuery('SELECT default_timer FROM retro_boards WHERE id = $1', [boardId]);
            expect(result.rows[0].default_timer).toBe(600);
        });
    });

    // --- startRetroTimer ---
    describe('startRetroTimer', () => {
        it('should set timer_running to true and reset time_left to default_timer', async () => {
            const boardId = uuidv4();
            await retroDb.createRetroBoard(boardId, 'Timer Board', null, {
                defaultTimer: 180,
            });

            // Manually set time_left to something different
            await executeQuery('UPDATE retro_boards SET time_left = 50 WHERE id = $1', [boardId]);

            await retroDb.startRetroTimer(boardId);

            const result = await executeQuery(
                'SELECT timer_running, time_left, default_timer FROM retro_boards WHERE id = $1',
                [boardId]
            );
            expect(result.rows[0].timer_running).toBe(true);
            expect(result.rows[0].time_left).toBe(180); // Reset to default_timer
            expect(result.rows[0].default_timer).toBe(180);
        });
    });

    // --- stopRetroTimer ---
    describe('stopRetroTimer', () => {
        it('should set timer_running to false', async () => {
            const boardId = uuidv4();
            await retroDb.createRetroBoard(boardId, 'Stop Timer Board', null);

            // Start timer first
            await retroDb.startRetroTimer(boardId);
            // Verify it's running
            let result = await executeQuery('SELECT timer_running FROM retro_boards WHERE id = $1', [boardId]);
            expect(result.rows[0].timer_running).toBe(true);

            await retroDb.stopRetroTimer(boardId);

            result = await executeQuery('SELECT timer_running FROM retro_boards WHERE id = $1', [boardId]);
            expect(result.rows[0].timer_running).toBe(false);
        });
    });

    // --- updateRetroTimer ---
    describe('updateRetroTimer', () => {
        it('should update time_left', async () => {
            const boardId = uuidv4();
            await retroDb.createRetroBoard(boardId, 'Update Timer Board', null);

            await retroDb.updateRetroTimer(boardId, 42);

            const result = await executeQuery(
                'SELECT time_left FROM retro_boards WHERE id = $1',
                [boardId]
            );
            expect(result.rows[0].time_left).toBe(42);
        });
    });
});
