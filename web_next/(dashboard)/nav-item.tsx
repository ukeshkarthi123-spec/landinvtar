import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Link, usePathname } from 'expo-router';
import clsx from 'clsx';

export function NavItem({
  href,
  label,
  children
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link href={href as any} asChild>
      <TouchableOpacity
        style={[
          styles.button,
          isActive && styles.activeButton
        ]}
      >
        {children}
        {/* Tooltips are skipped for native for now */}
      </TouchableOpacity>
    </Link>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginVertical: 4,
  },
  activeButton: {
    backgroundColor: '#F1F5F9',
  },
  label: {
    display: 'none',
  }
});
