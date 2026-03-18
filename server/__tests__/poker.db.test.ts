import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { v4 as uuidv4 } from 'uuid';

import * as pokerDb from '../db/poker.js';
import { pool } from '../db/pool.js';
import { executeQuery } from '../db/dbUtils.js';
import * as usersDb from '../db/users.js';
import * as workspacesDb from '../db/workspaces.js';

describe('Poker DB Functions (server/db/poker.js)', () => {

    beforeEach(async () => {
        await executeQuery('TRUNCATE TABLE participants RESTART IDENTITY CASCADE;');
        await executeQuery('TRUNCATE TABLE rooms RESTART IDENTITY CASCADE;');
        await executeQuery('TRUNCATE TABLE workspace_members RESTART IDENTITY CASCADE;');
        await executeQuery('TRUNCATE TABLE teams RESTART IDENTITY CASCADE;');
        await executeQuery('TRUNCATE TABLE workspaces RESTART IDENTITY CASCADE;');
        await executeQuery('TRUNCATE TABLE users RESTART IDENTITY CASCADE;');
    });

    afterAll(async () => {
        if (pool) await pool.end();
    });

    // --- createRoom ---
    describe('createRoom', () => {
        it('should create a room and verify it exists in DB', async () => {
            const roomId = uuidv4();
            const name = 'Test Room';
            const sequence = 'fibonacci';

            await pokerDb.createRoom(roomId, name, sequence);

            const result = await executeQuery('SELECT * FROM rooms WHERE id = $1', [roomId]);
            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].id).toBe(roomId);
            expect(result.rows[0].name).toBe(name);
            expect(result.rows[0].sequence).toBe(sequence);
            expect(result.rows[0].password).toBeNull();
            expect(result.rows[0].workspace_id).toBeNull();
        });

        it('should create a room with a password', async () => {
            const roomId = uuidv4();
            await pokerDb.createRoom(roomId, 'Password Room', 'fibonacci', 'hashed-password');

            const result = await executeQuery('SELECT * FROM rooms WHERE id = $1', [roomId]);
            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].password).toBe('hashed-password');
        });

        it('should create a room linked to a workspace', async () => {
            const owner = await usersDb.createUser('owner@test.com', 'pass', 'Owner');
            const ws = await workspacesDb.createWorkspace('Test WS', 'desc', owner.id);

            const roomId = uuidv4();
            await pokerDb.createRoom(roomId, 'WS Room', 'fibonacci', null, ws.id);

            const result = await executeQuery('SELECT * FROM rooms WHERE id = $1', [roomId]);
            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].workspace_id).toBe(ws.id);
        });

        it('should use roomId as name when name is undefined', async () => {
            const roomId = uuidv4();
            await pokerDb.createRoom(roomId, undefined, 'fibonacci');

            const result = await executeQuery('SELECT * FROM rooms WHERE id = $1', [roomId]);
            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].name).toBe(roomId);
        });
    });

    // --- getRooms ---
    describe('getRooms', () => {
        it('should return only public rooms (workspace_id IS NULL)', async () => {
            const owner = await usersDb.createUser('owner-getrooms@test.com', 'pass', 'Owner');
            const ws = await workspacesDb.createWorkspace('WS for getRooms', 'desc', owner.id);

            const publicRoomId = uuidv4();
            const wsRoomId = uuidv4();
            await pokerDb.createRoom(publicRoomId, 'Public Room', 'fibonacci');
            await pokerDb.createRoom(wsRoomId, 'WS Room', 'fibonacci', null, ws.id);

            const rooms = await pokerDb.getRooms();

            expect(rooms).toHaveLength(1);
            expect(rooms[0].id).toBe(publicRoomId);
            expect(rooms[0].name).toBe('Public Room');
        });

        it('should return empty array when no public rooms exist', async () => {
            const rooms = await pokerDb.getRooms();
            expect(rooms).toEqual([]);
        });

        it('should include participant count', async () => {
            const roomId = uuidv4();
            await pokerDb.createRoom(roomId, 'Room with participants', 'fibonacci');
            await pokerDb.addParticipant(roomId, uuidv4(), 'Alice');
            await pokerDb.addParticipant(roomId, uuidv4(), 'Bob');

            const rooms = await pokerDb.getRooms();
            expect(rooms).toHaveLength(1);
            // participant_count comes back as a string from COUNT aggregate
            expect(Number(rooms[0].participant_count)).toBe(2);
        });
    });

    // --- getWorkspaceRooms ---
    describe('getWorkspaceRooms', () => {
        it('should return only rooms for the given workspace', async () => {
            const owner = await usersDb.createUser('owner-wsrooms@test.com', 'pass', 'Owner');
            const ws1 = await workspacesDb.createWorkspace('WS1', 'desc', owner.id);
            const ws2 = await workspacesDb.createWorkspace('WS2', 'desc', owner.id);

            const room1Id = uuidv4();
            const room2Id = uuidv4();
            const room3Id = uuidv4();
            await pokerDb.createRoom(room1Id, 'WS1 Room', 'fibonacci', null, ws1.id);
            await pokerDb.createRoom(room2Id, 'WS2 Room', 'fibonacci', null, ws2.id);
            await pokerDb.createRoom(room3Id, 'Public Room', 'fibonacci');

            const rooms = await pokerDb.getWorkspaceRooms(ws1.id);

            expect(rooms).toHaveLength(1);
            expect(rooms[0].id).toBe(room1Id);
            expect(rooms[0].name).toBe('WS1 Room');
        });

        it('should return empty array for workspace with no rooms', async () => {
            const owner = await usersDb.createUser('owner-empty-ws@test.com', 'pass', 'Owner');
            const ws = await workspacesDb.createWorkspace('Empty WS', 'desc', owner.id);

            const rooms = await pokerDb.getWorkspaceRooms(ws.id);
            expect(rooms).toEqual([]);
        });
    });

    // --- getPokerRoomInfo ---
    describe('getPokerRoomInfo', () => {
        it('should return id and hasPassword flag (false when no password)', async () => {
            const roomId = uuidv4();
            await pokerDb.createRoom(roomId, 'No Pass Room', 'fibonacci');

            const info = await pokerDb.getPokerRoomInfo(roomId);

            expect(info).toBeDefined();
            expect(info!.id).toBe(roomId);
            expect(info!.hasPassword).toBe(false);
        });

        it('should return hasPassword true when room has a password', async () => {
            const roomId = uuidv4();
            await pokerDb.createRoom(roomId, 'Pass Room', 'fibonacci', 'some-hash');

            const info = await pokerDb.getPokerRoomInfo(roomId);

            expect(info).toBeDefined();
            expect(info!.hasPassword).toBe(true);
        });

        it('should return null for non-existent room', async () => {
            const info = await pokerDb.getPokerRoomInfo('non-existent-room');
            expect(info).toBeNull();
        });
    });

    // --- getRoom ---
    describe('getRoom', () => {
        it('should return room with participants map', async () => {
            const roomId = uuidv4();
            await pokerDb.createRoom(roomId, 'Detail Room', 'fibonacci');

            const p1Id = uuidv4();
            const p2Id = uuidv4();
            await pokerDb.addParticipant(roomId, p1Id, 'Alice');
            await pokerDb.addParticipant(roomId, p2Id, 'Bob');

            const room = await pokerDb.getRoom(roomId);

            expect(room).toBeDefined();
            expect(room!.id).toBe(roomId);
            expect(room!.name).toBe('Detail Room');
            expect(room!.sequence).toBe('fibonacci');
            expect(room!.participants).toBeInstanceOf(Map);
            expect(room!.participants.size).toBe(2);
            expect(room!.participants.get(p1Id)).toEqual({ id: p1Id, name: 'Alice', vote: null });
            expect(room!.participants.get(p2Id)).toEqual({ id: p2Id, name: 'Bob', vote: null });
        });

        it('should return room with empty participants map when no participants', async () => {
            const roomId = uuidv4();
            await pokerDb.createRoom(roomId, 'Empty Room', 'fibonacci');

            const room = await pokerDb.getRoom(roomId);

            expect(room).toBeDefined();
            expect(room!.participants).toBeInstanceOf(Map);
            expect(room!.participants.size).toBe(0);
        });

        it('should return null for non-existent room', async () => {
            const room = await pokerDb.getRoom('non-existent-room');
            expect(room).toBeNull();
        });
    });

    // --- addParticipant ---
    describe('addParticipant', () => {
        it('should add a participant to a room', async () => {
            const roomId = uuidv4();
            await pokerDb.createRoom(roomId, 'Add P Room', 'fibonacci');

            const participantId = uuidv4();
            await pokerDb.addParticipant(roomId, participantId, 'Charlie');

            const result = await executeQuery(
                'SELECT * FROM participants WHERE room_id = $1 AND id = $2',
                [roomId, participantId]
            );
            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].name).toBe('Charlie');
            expect(result.rows[0].vote).toBeNull();
        });
    });

    // --- updateParticipantVote ---
    describe('updateParticipantVote', () => {
        it('should update vote for a participant', async () => {
            const roomId = uuidv4();
            await pokerDb.createRoom(roomId, 'Vote Room', 'fibonacci');
            const pId = uuidv4();
            await pokerDb.addParticipant(roomId, pId, 'Alice');

            await pokerDb.updateParticipantVote(roomId, pId, '5');

            const result = await executeQuery(
                'SELECT vote FROM participants WHERE room_id = $1 AND id = $2',
                [roomId, pId]
            );
            expect(result.rows[0].vote).toBe('5');
        });

        it('should throw error for non-existent participant', async () => {
            const roomId = uuidv4();
            await pokerDb.createRoom(roomId, 'Vote Room 2', 'fibonacci');

            await expect(pokerDb.updateParticipantVote(roomId, 'bad-id', '3'))
                .rejects.toThrow();
        });
    });

    // --- updateParticipantName ---
    describe('updateParticipantName', () => {
        it('should update name for a participant', async () => {
            const roomId = uuidv4();
            await pokerDb.createRoom(roomId, 'Name Room', 'fibonacci');
            const pId = uuidv4();
            await pokerDb.addParticipant(roomId, pId, 'OldName');

            await pokerDb.updateParticipantName(roomId, pId, 'NewName');

            const result = await executeQuery(
                'SELECT name FROM participants WHERE room_id = $1 AND id = $2',
                [roomId, pId]
            );
            expect(result.rows[0].name).toBe('NewName');
        });

        it('should throw error for non-existent participant', async () => {
            const roomId = uuidv4();
            await pokerDb.createRoom(roomId, 'Name Room 2', 'fibonacci');

            await expect(pokerDb.updateParticipantName(roomId, 'bad-id', 'NewName'))
                .rejects.toThrow();
        });
    });

    // --- removeParticipant ---
    describe('removeParticipant', () => {
        it('should remove a participant from a room', async () => {
            const roomId = uuidv4();
            await pokerDb.createRoom(roomId, 'Remove P Room', 'fibonacci');
            const pId = uuidv4();
            await pokerDb.addParticipant(roomId, pId, 'ToRemove');

            await pokerDb.removeParticipant(roomId, pId);

            const result = await executeQuery(
                'SELECT * FROM participants WHERE room_id = $1 AND id = $2',
                [roomId, pId]
            );
            expect(result.rows).toHaveLength(0);
        });
    });

    // --- resetVotes ---
    describe('resetVotes', () => {
        it('should reset all votes in a room to null', async () => {
            const roomId = uuidv4();
            await pokerDb.createRoom(roomId, 'Reset Room', 'fibonacci');
            const p1Id = uuidv4();
            const p2Id = uuidv4();
            await pokerDb.addParticipant(roomId, p1Id, 'Alice');
            await pokerDb.addParticipant(roomId, p2Id, 'Bob');
            await pokerDb.updateParticipantVote(roomId, p1Id, '5');
            await pokerDb.updateParticipantVote(roomId, p2Id, '8');

            await pokerDb.resetVotes(roomId);

            const result = await executeQuery(
                'SELECT vote FROM participants WHERE room_id = $1',
                [roomId]
            );
            expect(result.rows).toHaveLength(2);
            for (const row of result.rows) {
                expect((row as Record<string, unknown>).vote).toBeNull();
            }
        });

        it('should throw error if room has no participants', async () => {
            const roomId = uuidv4();
            await pokerDb.createRoom(roomId, 'Empty Reset Room', 'fibonacci');

            await expect(pokerDb.resetVotes(roomId))
                .rejects.toThrow();
        });
    });

    // --- updateRoomSettings ---
    describe('updateRoomSettings', () => {
        it('should update sequence', async () => {
            const roomId = uuidv4();
            await pokerDb.createRoom(roomId, 'Settings Room', 'fibonacci');

            await pokerDb.updateRoomSettings(roomId, 'tshirt');

            const result = await executeQuery('SELECT sequence FROM rooms WHERE id = $1', [roomId]);
            expect(result.rows[0].sequence).toBe('tshirt');
        });

        it('should update password', async () => {
            const roomId = uuidv4();
            await pokerDb.createRoom(roomId, 'Settings Room 2', 'fibonacci');

            await pokerDb.updateRoomSettings(roomId, undefined, 'new-password-hash');

            const result = await executeQuery('SELECT password FROM rooms WHERE id = $1', [roomId]);
            expect(result.rows[0].password).toBe('new-password-hash');
        });

        it('should update both sequence and password', async () => {
            const roomId = uuidv4();
            await pokerDb.createRoom(roomId, 'Settings Room 3', 'fibonacci');

            await pokerDb.updateRoomSettings(roomId, 'powers', 'another-hash');

            const result = await executeQuery('SELECT sequence, password FROM rooms WHERE id = $1', [roomId]);
            expect(result.rows[0].sequence).toBe('powers');
            expect(result.rows[0].password).toBe('another-hash');
        });

        it('should do nothing when no settings are provided', async () => {
            const roomId = uuidv4();
            await pokerDb.createRoom(roomId, 'Settings Room 4', 'fibonacci');

            await pokerDb.updateRoomSettings(roomId);

            const result = await executeQuery('SELECT sequence, password FROM rooms WHERE id = $1', [roomId]);
            expect(result.rows[0].sequence).toBe('fibonacci');
            expect(result.rows[0].password).toBeNull();
        });
    });
});
