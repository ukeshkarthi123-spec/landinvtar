import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Enhanced storage utility with web fallback and error handling.
 * Compatible with latest expo-secure-store API.
 */

export const storage = {
  /**
   * Sets a value in secure storage or localStorage on web.
   */
  async setItem(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(key, value);
      } else {
        await SecureStore.setItemAsync(key, value);
      }
    } catch (error) {
      console.error(`[Storage] Error setting item for key "${key}":`, error);
    }
  },

  /**
   * Gets a value from secure storage or localStorage on web.
   */
  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(key);
      } else {
        return await SecureStore.getItemAsync(key);
      }
    } catch (error) {
      console.error(`[Storage] Error getting item for key "${key}":`, error);
      return null;
    }
  },

  /**
   * Deletes a value from secure storage or localStorage on web.
   */
  async deleteItem(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(key);
      } else {
        await SecureStore.deleteItemAsync(key);
      }
    } catch (error) {
      console.error(`[Storage] Error deleting item for key "${key}":`, error);
    }
  },
};
