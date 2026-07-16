import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useColorScheme, Appearance } from 'react-native';
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
  emerald: '#16C784',
  forest: '#0E9F6E',
  emeraldDark: '#0A8A57',
  emeraldLight: '#1EE09A',
  emeraldGlow: 'rgba(22, 199, 132, 0.15)',
  emeraldGlow2: 'rgba(22, 199, 132, 0.08)',
  bg: '#090909',
  bgCard: '#141414',
  bgCard2: '#1C1C1C',
  bgElevated: '#222222',
  bgInput: '#1A1A1A',
  textPrimary: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  textDisabled: '#4B5563',
  success: '#16C784',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  border: '#2A2A2A',
  borderLight: '#333333',
  gradientGreen: ['#16C784', '#0E9F6E'],
  gradientDark: ['#1C1C1C', '#141414'],
  gradientCard: ['rgba(22,199,132,0.12)', 'rgba(14,159,110,0.04)'],
  overlay: 'rgba(0,0,0,0.6)',
  glass: 'rgba(255,255,255,0.04)',
  glassBorder: 'rgba(255,255,255,0.08)',
};

const LightColors: ThemeColors = {
  emerald: '#16C784',
  forest: '#0E9F6E',
  emeraldDark: '#0A8A57',
  emeraldLight: '#1EE09A',
  emeraldGlow: 'rgba(22, 199, 132, 0.12)',
  emeraldGlow2: 'rgba(22, 199, 132, 0.06)',
  bg: '#F8FAFC',
  bgCard: '#FFFFFF',
  bgCard2: '#F1F5F9',
  bgElevated: '#FFFFFF',
  bgInput: '#F1F5F9',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textDisabled: '#CBD5E1',
  success: '#16C784',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  border: '#E2E8F0',
  borderLight: '#CBD5E1',
  gradientGreen: ['#16C784', '#0E9F6E'],
  gradientDark: ['#F1F5F9', '#E2E8F0'],
  gradientCard: ['rgba(22,199,132,0.08)', 'rgba(14,159,110,0.02)'],
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

  // Determine actual theme based on mode and system preference
  // If isLoading is true, we fallback to system preference immediately to avoid flash
  const isDark = mode === 'system' ? colorScheme === 'dark' : mode === 'dark';
  const colors = isDark ? DarkColors : LightColors;

  return (
    <ThemeContext.Provider value={{ mode, colors, isDark, isLoading, setMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
