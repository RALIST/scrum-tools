import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOMS_FILE = join(__dirname, 'rooms.json');

export async function loadRooms() {
    try {
        const data = await fs.readFile(ROOMS_FILE, 'utf8');
        const roomsData = JSON.parse(data);
        const rooms = new Map();

        // Convert the plain objects back to Maps
        Object.entries(roomsData).forEach(([roomId, roomData]) => {
            const participants = new Map();

            // Add participants if they exist
            if (roomData.participants) {
                roomData.participants.forEach(participant => {
                    participants.set(participant.id, participant);
                });
            }

            rooms.set(roomId, {
                id: roomId,
                name: roomData.name,
                createdAt: roomData.createdAt,
                sequence: roomData.sequence || 'fibonacci',
                password: roomData.password,
                participants
            });
        });

        return rooms;
    } catch (error) {
        if (error.code === 'ENOENT') {
            // If file doesn't exist, create it with empty data
            await fs.writeFile(ROOMS_FILE, JSON.stringify({}, null, 2));
            return new Map();
        }
        throw error;
    }
}

export async function saveRooms(rooms) {
    const roomsObj = {};
    rooms.forEach((room, roomId) => {
        roomsObj[roomId] = {
            id: roomId,
            name: room.name,
            sequence: room.sequence,
            password: room.password,
            participants: Array.from(room.participants.values()),
            createdAt: room.createdAt
        };
    });
    await fs.writeFile(ROOMS_FILE, JSON.stringify(roomsObj, null, 2));
}

export function createRoom(roomId, name = '', sequence = 'fibonacci', password = null) {
    return {
        id: roomId,
        name: name || roomId,
        sequence,
        password,
        participants: new Map(),
        createdAt: new Date().toISOString()
    };
}
