import React, { useState } from 'react';
import { View, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';

export function SearchInput() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [isPending, setIsPending] = useState(false);

  const handleSearch = () => {
    if (!query.trim()) return;
    setIsPending(true);
    router.replace(`/(dashboard)/dashboard_index?q=${encodeURIComponent(query)}` as any);
    setIsPending(false);
  };

  return (
    <View style={styles.container}>
      <Search size={18} color="#94A3B8" style={styles.icon} />
      <TextInput
        style={styles.input}
        placeholder="Search..."
        placeholderTextColor="#94A3B8"
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={handleSearch}
        returnKeyType="search"
      />
      {isPending && <ActivityIndicator size="small" color="#00E38C" style={styles.spinner} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    flex: 1,
    maxWidth: 300,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  spinner: {
    marginLeft: 8,
  }
});
