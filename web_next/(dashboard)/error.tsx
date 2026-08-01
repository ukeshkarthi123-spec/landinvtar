import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerBox}>
        <Text style={styles.title}>Please complete setup</Text>
        <Text style={styles.description}>
          Inside the Vercel Postgres dashboard, create a table based on the
          schema defined in this repository.
        </Text>

        <View style={styles.codeBlock}>
          <Text style={styles.codeText}>
            {`CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  username VARCHAR(255)
);`}
          </Text>
        </View>

        <Text style={styles.description}>Insert a row for testing:</Text>

        <View style={styles.codeBlock}>
          <Text style={styles.codeText}>
            {`INSERT INTO users (id, email, name, username) VALUES (1, 'me@site.com', 'Me', 'username');`}
          </Text>
        </View>

        <TouchableOpacity style={styles.resetButton} onPress={() => reset()}>
          <Text style={styles.resetButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: '#fff',
  },
  headerBox: {
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    color: '#64748B',
    marginBottom: 12,
  },
  codeBlock: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
  },
  codeText: {
    color: '#F8FAFC',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
  },
  resetButton: {
    marginTop: 24,
    backgroundColor: '#00E38C',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
