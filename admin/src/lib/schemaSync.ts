import { supabase } from './supabase';

/**
 * Utility to diagnose and potentially fix PostgREST schema cache issues.
 */
export const schemaSync = {
  /**
   * Checks if an error is related to a missing column in the schema cache.
   */
  isSchemaCacheError(error: any): boolean {
    if (!error) return false;
    const message = error.message || '';
    return message.toLowerCase().includes('schema cache') ||
           message.toLowerCase().includes('could not find the');
  },

  /**
   * Provides the SQL command required to refresh the cache.
   */
  getRefreshCommand(): string {
    return "NOTIFY pgrst, 'reload schema';";
  },

  /**
   * Attempts to reload the schema via an RPC call if configured on the server.
   * This requires a custom PostgreSQL function:
   * CREATE OR REPLACE FUNCTION reload_schema() RETURNS void AS $$
   * BEGIN
   *   NOTIFY pgrst, 'reload schema';
   * END; $$ LANGUAGE plpgsql;
   */
  async reloadViaRPC(): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.rpc('reload_schema');
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
};
