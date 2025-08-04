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
      console.error('Error reading username from localStorage', error);
      return null;
    }
  }, [isAuthenticated, user?.name]); // Recalculate if auth state changes

  const [userName, setUserName] = useState<string | null>(initialName);
  const [hasManuallyChangedName, setHasManuallyChangedName] = useState(false); // Track if user manually changed name

  // Effect to update userName if auth state changes *after* initial load
  useEffect(() => {
    // Only auto-update from auth if the user hasn't manually changed their name
    if (isAuthenticated && user?.name && !hasManuallyChangedName) {
      setUserName(user.name);
      // Optionally clear localStorage if user logs in?
      // try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    } else if (!isAuthenticated && userName !== initialName && !hasManuallyChangedName) {
      // If user logs out, revert to initial name (which might be from localStorage or null)
      setUserName(initialName);
    }
  }, [isAuthenticated, user?.name, initialName, userName, hasManuallyChangedName]);

  const setUserNameAndStorage = useCallback(
    (newName: string) => {
      // Mark that the user has manually changed their name
      setHasManuallyChangedName(true);

      // For authenticated users, we still update the local state for the retro session
      // but we don't save to localStorage (their account name remains unchanged)
      if (isAuthenticated) {
        setUserName(newName);
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
        console.error('Error saving username to localStorage', error);
        setUserName(newName); // Update state anyway
      }
    },
    [isAuthenticated]
  ); // Depend on isAuthenticated

  // Determine if the name is fixed (for retro sessions, names are not fixed even for authenticated users)
  const isNameFixed = false; // Allow all users to change their retro display name

  return { userName, setUserNameAndStorage, isNameFixed };
};
