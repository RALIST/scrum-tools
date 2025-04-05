import { useState, useEffect, useRef } from 'react';
import { Manager } from 'socket.io-client';
import type { Socket as ClientSocket } from 'socket.io-client';
import config from '../config'; // Assuming config has socketUrl

interface UseSocketManagerProps {
    namespace: string; // e.g., '/poker', '/retro'
    autoConnect?: boolean; // Default true
    onConnect?: () => void;
    onDisconnect?: (reason: ClientSocket.DisconnectReason) => void;
    onError?: (err: Error) => void;
}

interface UseSocketManagerResult {
    socket: ClientSocket | null; // Return the current socket instance
    isConnected: boolean;
    isConnecting: boolean;
    manager: Manager | null;
}

const debugLog = (namespace: string, message: string, data?: any) => {
    console.log(`[useSocketManager:${namespace}] ${message}`, data || '');
};

const managers = new Map<string, Manager>();

export const useSocketManager = ({
    namespace,
    autoConnect = true,
    onConnect,
    onDisconnect,
    onError,
}: UseSocketManagerProps): UseSocketManagerResult => {
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const socketRef = useRef<ClientSocket | null>(null);
    const managerRef = useRef<Manager | null>(null);
    const onConnectRef = useRef(onConnect);
    const onDisconnectRef = useRef(onDisconnect);
    const onErrorRef = useRef(onError);

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
        const socketUrl = config.socketUrl;

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
                timeout: 10000,
                transports: ['websocket', 'polling'],
                autoConnect: false,
            });
            managers.set(socketUrl, manager);
        }
        managerRef.current = manager;

        const newSocket = manager.socket(namespace);
        socketRef.current = newSocket;

        // Log instance creation, but ID might be undefined initially
        debugLog(namespace, `Socket instance obtained (id might be undefined initially)`);

        const handleConnect = () => {
            // Log ID here, where it's guaranteed to be available
            debugLog(namespace, `Connected: ${newSocket.id}`);
            setIsConnected(true);
            setIsConnecting(false);
            onConnectRef.current?.();
        };

        const handleDisconnect = (reason: ClientSocket.DisconnectReason) => {
            // Log ID here
            debugLog(namespace, `Disconnected: ${newSocket.id}`, { reason });
            setIsConnected(false);
            setIsConnecting(false);
            onDisconnectRef.current?.(reason);
        };

        const handleConnectError = (err: Error) => {
            // Log ID here
            debugLog(namespace, `Connection Error: ${newSocket.id}`, err);
            setIsConnected(false);
            setIsConnecting(false);
            onErrorRef.current?.(err);
        };

        newSocket.off('connect', handleConnect);
        newSocket.off('disconnect', handleDisconnect);
        newSocket.off('connect_error', handleConnectError);

        newSocket.on('connect', handleConnect);
        newSocket.on('disconnect', handleDisconnect);
        newSocket.on('connect_error', handleConnectError);

        // Handle connection state based on current socket status
        if (newSocket.connected) {
            handleConnect(); // Already connected, trigger handler
        } else if (autoConnect && !isConnecting) { // Check !isConnecting to avoid multiple connect calls
            debugLog(namespace, `Auto-connecting socket (id might be undefined initially)`);
            setIsConnecting(true);
            newSocket.connect();
        } else {
            // Reflect current connected state, connecting state is handled by connect() call or events
            setIsConnected(newSocket.connected);
            // Removed setting isConnecting based on newSocket.connecting
        }

        // Cleanup function
        return () => {
            // Log ID here before cleanup
            debugLog(namespace, `Cleaning up socket: ${newSocket.id}`);
            newSocket.off('connect', handleConnect);
            newSocket.off('disconnect', handleDisconnect);
            newSocket.off('connect_error', handleConnectError);

            newSocket.disconnect();

            if (socketRef.current === newSocket) {
                socketRef.current = null;
            }
            setIsConnected(false);
            setIsConnecting(false);
        };
    }, [namespace, autoConnect]);

    return {
        socket: socketRef.current,
        isConnected,
        isConnecting,
        manager: managerRef.current,
    };
};
