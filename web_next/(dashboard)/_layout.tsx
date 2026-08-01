import React from 'react';
import { Slot } from 'expo-router';
import { Providers } from './providers';

export default function DashboardLayout() {
  return (
    <Providers>
      <Slot />
    </Providers>
  );
}
