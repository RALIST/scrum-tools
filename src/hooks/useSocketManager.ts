import { useState, useEffect, useRef } from 'react';
import { Manager } from 'socket.io-client';
import type { Socket as ClientSocket } from 'socket.io-client';
import config from '../config'; // Assuming config has socketUrl

interface UseSocketManagerProps {
    namespace: string; // e.g., '/poker', '/retro'
    autoConnect?: boolean; // Default true
    // Optional callbacks for basic events, can be expanded
    onConnect?: () => void;
    onDisconnect?: (reason: ClientSocket.DisconnectReason) => void;
    onError?: (err: Error) => void;
}

interface UseSocketManagerResult {
    socket: ClientSocket | null;
    isConnected: boolean;
    isConnecting: boolean; // Simple connecting state
    manager: Manager | null; // Expose manager if needed, maybe remove later
}

const debugLog = (namespace: string, message: string, data?: any) => {
    console.log(`[useSocketManager:${namespace}] ${message}`, data || '');
};

// Store manager instances globally based on URL to reuse connections
const managers = new Map<string, Manager>();

export const useSocketManager = ({
    namespace,
    autoConnect = true,
    onConnect,
    onDisconnect,
    onError,
}: UseSocketManagerProps): UseSocketManagerResult => {
    const [socket, setSocket] = useState<ClientSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
     const socketRef = useRef<ClientSocket | null>(null);
     const managerRef = useRef<Manager | null>(null);
     // Refs to store the latest callbacks without causing effect re-runs
     const onConnectRef = useRef(onConnect);
     const onDisconnectRef = useRef(onDisconnect);
     const onErrorRef = useRef(onError);

     // Update refs when callbacks change
     useEffect(() => {
         onConnectRef.current = onConnect;
     }, [onConnect]);

     useEffect(() => {
         onDisconnectRef.current = onDisconnect;
     }, [onDisconnect]);

     useEffect(() => {
         onErrorRef.current = onError;
     }, [onError]);


     useEffect(() => {
         if (!namespace) {
            debugLog('?', 'Namespace is required');
            return;
        }

        let manager: Manager;
        const socketUrl = config.socketUrl; // Get URL from config

        // Get or create a Manager instance for the URL
        if (managers.has(socketUrl)) {
            manager = managers.get(socketUrl)!;
            debugLog(namespace, 'Reusing existing Manager instance');
        } else {
            debugLog(namespace, 'Creating new Manager instance');
            manager = new Manager(socketUrl, {
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                timeout: 10000, // Connection timeout
                transports: ['websocket', 'polling'],
                autoConnect: false, // We control connection manually or via autoConnect prop
            });
            managers.set(socketUrl, manager);
        }
        managerRef.current = manager;

        // Create the socket instance for the specific namespace
        const newSocket = manager.socket(namespace);
        socketRef.current = newSocket;
        setSocket(newSocket);
        debugLog(namespace, `Socket instance created: ${newSocket.id}`);

        const handleConnect = () => {
             debugLog(namespace, `Connected: ${newSocket.id}`);
             setIsConnected(true);
             setIsConnecting(false);
             onConnectRef.current?.(); // Call latest callback via ref
         };

         const handleDisconnect = (reason: ClientSocket.DisconnectReason) => {
             debugLog(namespace, `Disconnected: ${newSocket.id}`, { reason });
             setIsConnected(false);
             setIsConnecting(false); // Also false on disconnect
             onDisconnectRef.current?.(reason); // Call latest callback via ref
         };

         const handleConnectError = (err: Error) => {
             debugLog(namespace, `Connection Error: ${newSocket.id}`, err);
             setIsConnected(false);
             setIsConnecting(false);
             onErrorRef.current?.(err); // Call latest callback via ref
         };

        // Attach listeners
        newSocket.on('connect', handleConnect);
        newSocket.on('disconnect', handleDisconnect);
        newSocket.on('connect_error', handleConnectError);

        // Connect if autoConnect is true and not already connecting/connected
        if (autoConnect && !newSocket.connected && !isConnecting) {
            debugLog(namespace, `Auto-connecting socket: ${newSocket.id}`);
            setIsConnecting(true);
            newSocket.connect();
        } else if (newSocket.connected) {
             // If already connected (e.g. manager reused), update state
             setIsConnected(true);
             setIsConnecting(false);
        } else {
             setIsConnecting(false); // Ensure connecting is false if not auto-connecting
        }


        // Cleanup function
        return () => {
            debugLog(namespace, `Cleaning up socket: ${newSocket.id}`);
            // Detach listeners
            newSocket.off('connect', handleConnect);
            newSocket.off('disconnect', handleDisconnect);
            newSocket.off('connect_error', handleConnectError);

            // Disconnect the socket for this specific namespace instance
            // The manager might still be used by other hooks/namespaces
            newSocket.disconnect();

            if (socketRef.current === newSocket) {
                socketRef.current = null;
                setSocket(null);
            }
            setIsConnected(false);
            setIsConnecting(false);

            // Optional: Clean up manager if no sockets are left?
            // This is complex as other parts of the app might use the same manager.
            // For now, let managers persist. A more robust solution might involve ref counting.
            // if (manager && manager.engine.clientsCount === 0) {
            //     debugLog(namespace, 'Disconnecting manager as no clients are left');
            //     manager.disconnect();
            //     managers.delete(socketUrl);
             // }
         };
     // Re-run effect ONLY if namespace or autoConnect changes
     }, [namespace, autoConnect]);

     // TODO: Add manual connect/disconnect functions if needed (e.g., socketRef.current?.connect())

    return {
        socket,
        isConnected,
        isConnecting,
        manager: managerRef.current, // Expose manager (optional)
    };
};
