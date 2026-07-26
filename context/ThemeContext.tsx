import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  // Primary
  emerald: string;
  forest: string;
  emeraldDark: string;
  emeraldLight: string;
  emeraldGlow: string;
  emeraldGlow2: string;

  // Background
  bg: string;
  bgCard: string;
  bgCard2: string;
  bgElevated: string;
  bgInput: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textDisabled: string;

  // Status
  success: string;
  warning: string;
  error: string;
  info: string;

  // Borders
  border: string;
  borderLight: string;

  // Gradients
  gradientGreen: [string, string];
  gradientDark: [string, string];
  gradientCard: [string, string];

  // Overlay
  overlay: string;
  glass: string;
  glassBorder: string;
}

const DarkColors: ThemeColors = {
  emerald: '#00E38C', // User requested premium green
  forest: '#00C476',
  emeraldDark: '#00A852',
  emeraldLight: '#33FFA5',
  emeraldGlow: 'rgba(0, 227, 140, 0.15)',
  emeraldGlow2: 'rgba(0, 227, 140, 0.08)',
  bg: '#0F1115',      // User requested background
  bgCard: '#161B22',  // Groww/CRED style card
  bgCard2: '#1C222B',
  bgElevated: '#212932',
  bgInput: '#161B22',
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A0', // User requested secondary text
  textMuted: '#6B7280',
  textDisabled: '#4B5563',
  success: '#00E38C',
  warning: '#FF9800',
  error: '#FF4D4D',
  info: '#3B82F6',
  border: '#2D333B',
  borderLight: '#3D444D',
  gradientGreen: ['#00E38C', '#00C476'],
  gradientDark: ['#161B22', '#0F1115'],
  gradientCard: ['rgba(0, 227, 140, 0.12)', 'rgba(0, 196, 118, 0.04)'],
  overlay: 'rgba(0,0,0,0.8)',
  glass: 'rgba(255,255,255,0.04)',
  glassBorder: 'rgba(255,255,255,0.08)',
};

// Even in "light" mode for this app, we'll maintain a dark-ish aesthetic or keep it consistent.
// However, I'll update it to be a clean white theme that still uses the premium accent.
const LightColors: ThemeColors = {
  emerald: '#00E38C',
  forest: '#00C476',
  emeraldDark: '#00A852',
  emeraldLight: '#33FFA5',
  emeraldGlow: 'rgba(0, 227, 140, 0.12)',
  emeraldGlow2: 'rgba(0, 227, 140, 0.06)',
  bg: '#F8FAFC',
  bgCard: '#FFFFFF',
  bgCard2: '#F1F5F9',
  bgElevated: '#FFFFFF',
  bgInput: '#F1F5F9',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textDisabled: '#CBD5E1',
  success: '#00E38C',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  border: '#E2E8F0',
  borderLight: '#CBD5E1',
  gradientGreen: ['#00E38C', '#00C476'],
  gradientDark: ['#F1F5F9', '#E2E8F0'],
  gradientCard: ['rgba(0, 227, 140, 0.08)', 'rgba(0, 196, 118, 0.02)'],
  overlay: 'rgba(0,0,0,0.5)',
  glass: 'rgba(0,0,0,0.02)',
  glassBorder: 'rgba(0,0,0,0.06)',
};

interface ThemeContextType {
  mode: ThemeMode;
  colors: ThemeColors;
  isDark: boolean;
  isLoading: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'system',
  colors: DarkColors,
  isDark: true,
  isLoading: true,
  setMode: () => {},
  toggleTheme: () => {},
});

const THEME_STORAGE_KEY = '@investland_theme_mode';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const colorScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [isLoading, setIsLoading] = useState(true);

  // Load saved theme preference
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved && (saved === 'light' || saved === 'dark' || saved === 'system')) {
          setModeState(saved as ThemeMode);
        }
      } catch (e) {
        console.error('Failed to load theme preference', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadTheme();
  }, []);

  const setMode = useCallback(async (newMode: ThemeMode) => {
    setModeState(newMode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
    } catch (e) {
      console.error('Failed to save theme preference', e);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setModeState((currentMode) => {
      let nextMode: ThemeMode;
      if (currentMode === 'system') {
        nextMode = colorScheme === 'dark' ? 'light' : 'dark';
      } else if (currentMode === 'dark') {
        nextMode = 'light';
      } else {
        nextMode = 'system';
      }
      AsyncStorage.setItem(THEME_STORAGE_KEY, nextMode).catch(console.error);
      return nextMode;
    });
  }, [colorScheme]);

  const isDark = mode === 'system' ? colorScheme === 'dark' : mode === 'dark';
  const colors = isDark ? DarkColors : LightColors;

  return (
    <ThemeContext.Provider value={{ mode, colors, isDark, isLoading, setMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
