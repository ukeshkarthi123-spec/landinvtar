import { useApp } from '@/context/AppContext';

export function useBiometrics() {
  const { isLocked, loading, unlockApp } = useApp();

  return {
    isLocked,
    loading,
    authenticate: unlockApp
  };
}
