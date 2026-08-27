import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// ── Reads the persisted/preferred theme outside of React state so the
//    initializer never touches `window` on the server (SSR safe).
function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';

  const saved = localStorage.getItem('theme') as Theme | null;
  if (saved === 'light' || saved === 'dark') return saved;

  return window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}

// ── Applies the theme class to <html> and keeps meta theme-color in sync.
//    Called both on mount and on every theme change.
function applyTheme(theme: Theme) {
  const root = document.documentElement;

  // Ensure ONLY one theme class is present at a time
  root.classList.remove('light', 'dark');
  root.classList.add(theme);

  // Also set a data attribute — handy for CSS [data-theme] selectors
  root.setAttribute('data-theme', theme);

  // Persist
  localStorage.setItem('theme', theme);

  // Update mobile browser chrome color to match new palette
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute(
      'content',
      theme === 'dark'
        ? '#09090b'   // --color-background dark  (#09090b true black)
        : '#f8f9fb'   // --color-background light (#f8f9fb near-white)
    );
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  // Apply on mount + whenever theme changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Keep in sync if the user changes their OS preference while the tab is open
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');

    const handleChange = (e: MediaQueryListEvent) => {
      // Only follow system preference if the user hasn't manually set one
      if (!localStorage.getItem('theme')) {
        setThemeState(e.matches ? 'light' : 'dark');
      }
    };

    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = () =>
    setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'));

  const setTheme = (newTheme: Theme) => setThemeState(newTheme);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};