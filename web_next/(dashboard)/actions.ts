// Removed Next.js 'use server' directive as this is an Expo React Native application.
import { deleteProductById } from '@/lib/db';

export async function deleteProduct(id: number) {
  try {
    await deleteProductById(id);
    return { success: true };
  } catch (error) {
    console.error('Failed to delete product:', error);
    return { success: false, error };
  }
}
