import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";

type Shortcut = {
  key: string;
  description: string;
  action: () => void;
};

// Create the shortcuts context
const ShortcutsContext = createContext({
  shortcuts: {},
  registerShortcut: (id: string, shortcut: Shortcut) => {},
  unregisterShortcut: (id: string) => {},
  handleKeyPress: (e: KeyboardEvent) => {},
  mousePosition: { x: 0, y: 0 },
});

// Provider component
export const ShortcutsProvider = ({ children }) => {
  const [shortcuts, setShortcuts] = useState<Record<string, Shortcut>>({});
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Memoize these callbacks to prevent unnecessary re-renders
  const registerShortcut = useCallback((id: string, shortcut: Shortcut) => {
    setShortcuts((prev) => ({
      ...prev,
      [id]: shortcut,
    }));
  }, []);

  const unregisterShortcut = useCallback((id: string) => {
    setShortcuts((prev) => {
      const newShortcuts = { ...prev };
      delete newShortcuts[id];
      return newShortcuts;
    });
  }, []);

  const handleKeyPress = useCallback(
    (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      Object.values(shortcuts).forEach((shortcut: Shortcut) => {
        if (shortcut.key.toLowerCase() === key) {
          shortcut.action();
        }
      });
    },
    [shortcuts],
  );

  const handleMouseMove = useCallback((e: MouseEvent) => {
    setMousePosition({ x: e.clientX, y: e.clientY });
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [handleKeyPress]);

  const contextValue = useMemo(
    () => ({
      shortcuts,
      registerShortcut,
      unregisterShortcut,
      handleKeyPress,
      mousePosition,
    }),
    [
      shortcuts,
      registerShortcut,
      unregisterShortcut,
      handleKeyPress,
      mousePosition,
    ],
  );

  return (
    <ShortcutsContext.Provider value={contextValue}>
      {children}
    </ShortcutsContext.Provider>
  );
};

export const useShortcuts = () => useContext(ShortcutsContext);
