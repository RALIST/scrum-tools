import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext'; // Import useAuth

const STORAGE_KEY = 'retroUserName';

interface UseRetroUserResult {
    userName: string | null; // Can be null initially or if not set
    setUserNameAndStorage: (newName: string) => void;
    isNameFixed: boolean; // Flag indicating if name comes from auth
}

export const useRetroUser = (): UseRetroUserResult => {
    const { user, isAuthenticated } = useAuth(); // Get auth state

    // Determine the initial name: auth user name > localStorage > null
    const initialName = useMemo(() => {
        if (isAuthenticated && user?.name) {
            return user.name;
        }
        try {
            return localStorage.getItem(STORAGE_KEY) || null; // Return null if nothing found
        } catch (error) {
            console.error("Error reading username from localStorage", error);
            return null;
        }
    }, [isAuthenticated, user?.name]); // Recalculate if auth state changes

    const [userName, setUserName] = useState<string | null>(initialName);

    // Effect to update userName if auth state changes *after* initial load
    useEffect(() => {
        if (isAuthenticated && user?.name) {
            setUserName(user.name);
            // Optionally clear localStorage if user logs in?
            // try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
        } else if (!isAuthenticated && userName !== initialName) {
            // If user logs out, revert to initial name (which might be from localStorage or null)
            setUserName(initialName);
        }
    }, [isAuthenticated, user?.name, initialName, userName]);


    const setUserNameAndStorage = useCallback((newName: string) => {
        // Do nothing if the user is authenticated (name is fixed)
        if (isAuthenticated) {
            console.warn("Attempted to change retro name while authenticated.");
            return;
        }

        // Logic for non-authenticated users (saving to localStorage)
        try {
            const trimmedName = newName.trim();
            if (trimmedName) {
                localStorage.setItem(STORAGE_KEY, trimmedName);
                setUserName(trimmedName);
            } else {
                localStorage.removeItem(STORAGE_KEY);
                setUserName(null); // Set to null if name is cleared
            }
        } catch (error) {
            console.error("Error saving username to localStorage", error);
            setUserName(newName); // Update state anyway
        }
    }, [isAuthenticated]); // Depend on isAuthenticated

    // Determine if the name is fixed (comes from auth)
    const isNameFixed = isAuthenticated;

    return { userName, setUserNameAndStorage, isNameFixed };
};
