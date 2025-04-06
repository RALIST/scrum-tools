import express, { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import * as pokerDbFunctions from '../db/poker.js'; // Import DB functions (needs .js)
import * as workspaceDbFunctions from '../db/workspaces.js'; // Import DB functions (needs .js)
import { PokerRoom, PokerRoomDetails } from '../types/db.js'; // Import types (needs .js)

// Define types for injected DB modules
type PokerDbModule = typeof pokerDbFunctions;
type WorkspaceDbModule = typeof workspaceDbFunctions;

// Wrap routes in a setup function that accepts db dependencies
export default function setupPokerRoutes(
    pokerDb: PokerDbModule,
    workspaceDb: WorkspaceDbModule // Add workspaceDb dependency type
): Router {
    const router: Router = express.Router();

    // Get rooms - Filtered by workspace if authenticated and header provided, otherwise public rooms
    // optionalAuthenticateToken is applied globally in server/index.js
    router.get('/rooms', async (req: Request, res: Response, next: NextFunction) => {
        try {
            // req.user might be populated by the global optionalAuthenticateToken middleware
            // req.user is added by optionalAuthenticateToken middleware
            const userId: string | undefined = req.user?.userId;
            // workspaceId header could be string or string[] or undefined
            const workspaceIdHeader = req.headers['workspace-id'];
            const workspaceId: string | undefined = Array.isArray(workspaceIdHeader) ? workspaceIdHeader[0] : workspaceIdHeader;
            let rooms: PokerRoom[] = [];

            // Workspace Mode
            if (userId && workspaceId) {
                // Check if user is a member of the workspace
                // Assert non-null for userId and workspaceId as they are checked in the if condition
                const isMember: boolean = await workspaceDb.isWorkspaceMember(workspaceId!, userId!);
                if (!isMember) {
                    res.status(403).json({ error: 'User is not authorized to access rooms for this workspace.' });
                    return;
                }
                // Use injected dependency
                // Assert non-null for workspaceId
                rooms = await pokerDb.getWorkspaceRooms(workspaceId!);
            }
            // Public/Anonymous Mode
            else {
                // Use injected dependency
                rooms = await pokerDb.getRooms();
            }

            // Define the type for the mapped room list item
            interface RoomListItem {
                id: string;
                name: string;
                participantCount: number;
                createdAt: Date | string;
                hasPassword: boolean;
                sequence: string[] | string; // Keep original type from PokerRoom
                workspaceId: string | null | undefined;
            }

            const roomList: RoomListItem[] = rooms.map((room: PokerRoom) => ({
                id: room.id,
                name: room.name,
                // participant_count might be string from DB COUNT, ensure it's number
                participantCount: typeof room.participant_count === 'string'
                    ? parseInt(room.participant_count, 10)
                    : (room.participant_count ?? 0),
                createdAt: room.created_at,
                hasPassword: !!room.password, // Use password from PokerRoom type
                sequence: room.sequence,
                workspaceId: room.workspace_id
            }));
            res.json(roomList);
        } catch (error: any) { // Type error
            next(error);
        }
    });

    // Add 'next' to the parameters
    router.post('/rooms', async (req: Request, res: Response, next: NextFunction) => {
        // Get sequence key from body
        const { roomId, name, password, sequence, workspaceId } = req.body;
        const userId: string | undefined = req.user?.userId; // Get userId for workspace check
        const safe_sequence = sequence || "fibonacci"; // Default sequence if not provided

        try {
            // If workspaceId is provided, ensure the user is authenticated and a member
            if (workspaceId) {
                if (!userId) {
                    res.status(401).json({ error: 'Authentication required to create a workspace room.' });
                    return;
                }
                // Assert non-null for userId and workspaceId
                const isMember: boolean = await workspaceDb.isWorkspaceMember(workspaceId, userId!);
                if (!isMember) {
                    res.status(403).json({ error: 'User is not authorized to create a room in this workspace.' });
                    return;
                }
            }

            // Use injected dependency
            const room: PokerRoomDetails | null = await pokerDb.getRoom(roomId);
            if (room) {
                res.status(400).json({ error: 'Room already exists' });
                return;
            }

            const hashedPassword: string | null = password ? await bcrypt.hash(password, 10) : null;
            // Use injected dependency
            // Pass the looked-up sequenceArray (which is readonly string[])
            // Cast to string[] for the DB function which expects mutable (driver handles it)
            await pokerDb.createRoom(roomId, name, safe_sequence, hashedPassword, workspaceId);

            res.json({
                success: true,
                roomId,
                hasPassword: !!hashedPassword,
                sequence: sequence,
            });
        } catch (error: any) { // Type error
            next(error);
        }
    });

    // Add 'next' to the parameters
    router.post('/rooms/:roomId/verify-password', async (req: Request<{ roomId: string }>, res: Response, next: NextFunction) => {
        const { roomId } = req.params;
        const { password } = req.body;

        try {
            // Use injected dependency
            const room: PokerRoomDetails | null = await pokerDb.getRoom(roomId);
            if (!room) {
                res.status(404).json({ error: 'Room not found' });
                return;
            }

            if (!room.password) {
                res.json({ valid: true });
                return;
            }

            // room.password could be null, bcrypt handles it
            const isValid: boolean = await bcrypt.compare(password, room.password!); // Use non-null assertion after check
            res.json({ valid: isValid });
        } catch (error: any) { // Type error
            next(error);
        }
    });

    // Modified endpoint to get FULL room details (except password)
    router.get('/rooms/:roomId/info', async (req: Request<{ roomId: string }>, res: Response, next: NextFunction) => {
        const { roomId } = req.params;
        try {
            // Use injected dependency to get full details
            const roomDetails: PokerRoomDetails | null = await pokerDb.getRoom(roomId);

            if (!roomDetails) {
                res.status(404).json({ error: 'Room not found' });
                return;
            }

            // Omit the password field before sending
            const { password, ...roomInfoToSend } = roomDetails;

            // Convert participants Map to Array for JSON response
            const responsePayload = {
                ...roomInfoToSend,
                hasPassword: !!roomDetails.password, // Explicitly add hasPassword
                participants: Array.from(roomInfoToSend.participants.values())
            };


            res.json(responsePayload);
        } catch (error: any) { // Type error
            next(error);
        }
    });

    return router; // Return the configured router
}

// Removed default export of router instance
