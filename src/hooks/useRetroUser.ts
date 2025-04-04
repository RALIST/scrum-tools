import { useState, useCallback } from 'react';

const STORAGE_KEY = 'retroUserName';

interface UseRetroUserResult {
    userName: string;
    setUserNameAndStorage: (newName: string) => void;
}

export const useRetroUser = (): UseRetroUserResult => {
    const [userName, setUserName] = useState<string>(() => {
        try {
            return localStorage.getItem(STORAGE_KEY) || '';
        } catch (error) {
            console.error("Error reading username from localStorage", error);
            return '';
        }
    });

    const setUserNameAndStorage = useCallback((newName: string) => {
        try {
            const trimmedName = newName.trim();
            if (trimmedName) {
                localStorage.setItem(STORAGE_KEY, trimmedName);
                setUserName(trimmedName);
            } else {
                // Optionally handle empty name case, e.g., remove from storage or keep previous
                localStorage.removeItem(STORAGE_KEY); // Example: remove if empty
                setUserName('');
            }
        } catch (error) {
            console.error("Error saving username to localStorage", error);
            // Still update state even if storage fails? Or show error?
            setUserName(newName); // Update state anyway for UI consistency
        }
    }, []);

    return { userName, setUserNameAndStorage };
};
