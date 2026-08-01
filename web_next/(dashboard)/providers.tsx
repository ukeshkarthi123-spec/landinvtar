import React from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  // TooltipProvider is not native compatible. Skipping it for now.
  return <>{children}</>;
}
