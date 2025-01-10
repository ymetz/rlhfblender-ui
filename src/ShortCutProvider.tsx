import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { } from '@mui/icons-material';

type Shortcut = {
    key: string;
    description: string;
    action: () => void;
    };

// Create the shortcuts context
const ShortcutsContext = createContext({
  shortcuts: {},
  registerShortcut: (id: string, shortcut: Shortcut) => {},
  handleKeyPress: (e: KeyboardEvent) => {},
  mousePosition: { x: 0, y: 0 }
});

// Provider component
export const ShortcutsProvider = ({ children }) => {
  const [shortcuts, setShortcuts] = useState<Record<string, Shortcut>>({});
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const registerShortcut = useCallback((id, shortcut) => {
    setShortcuts(prev => ({
      ...prev,
      [id]: shortcut
    }));
  }, []);

  const handleKeyPress = useCallback((e) => {
    const key = e.key.toLowerCase();
    Object.values(shortcuts).forEach((shortcut: Shortcut) => {
      if (shortcut.key.toLowerCase() === key) {
        //shortcut.action();
      }
    });
  }, [shortcuts]);

  const handleMouseMove = useCallback((e) => {
    setMousePosition({ x: e.clientX, y: e.clientY });
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    //window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      //window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [handleKeyPress, handleMouseMove]);

  return (
    <ShortcutsContext.Provider value={{ 
      shortcuts, 
      registerShortcut,
      handleKeyPress,
      mousePosition 
    }}>
      {children}
    </ShortcutsContext.Provider>
  );
};

export const useShortcuts = () => useContext(ShortcutsContext);