import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export function User() {
  const router = useRouter();
  const user = null; // session?.user;

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={() => router.push('/profile')}
    >
      <Image
        source={{ uri: user?.image ?? 'https://ui-avatars.com/api/?name=User' }}
        style={styles.avatar}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  }
});

export default User;
