import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
  setTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pulsar_theme') as Theme;
      if (saved === 'light' || saved === 'dark') return saved;
      return 'dark'; // Default premium dark
    }
    return 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    root.setAttribute('data-theme', theme);
    body.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;

    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      body.classList.add('dark', 'theme-dark');
      body.classList.remove('light', 'theme-light');
      body.style.backgroundColor = '#0A100C';
      body.style.color = '#F1F5F9';
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      body.classList.remove('dark', 'theme-dark');
      body.classList.add('light', 'theme-light');
      body.style.backgroundColor = '#EDF0E1';
      body.style.color = '#172338';
    }

    // Update mobile PWA / browser theme-color meta tag
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme === 'dark' ? '#0A100C' : '#EDF0E1');
    }

    try {
      localStorage.setItem('pulsar_theme', theme);
    } catch (e) {
      console.warn('LocalStorage error saving theme:', e);
    }
  }, [theme]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
