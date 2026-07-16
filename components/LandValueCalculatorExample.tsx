/**
 * Example usage of the Land Value Growth Calculator
 * This demonstrates how to integrate the calculator into your app
 */

import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import {
  calculateLandValueGrowth,
  calculateLandValueLocal,
  projectLandValueGrowth,
  calculateRequiredGrowthRate,
  type LandValueData,
} from '@/lib/land-value-calculator';

export function LandValueCalculatorExample() {
  const [todayValue, setTodayValue] = useState('100000');
  const [growthRate, setGrowthRate] = useState('0.001');
  const [result, setResult] = useState<LandValueData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Example 1: Calculate tomorrow's value using backend
  const handleCalculateWithBackend = useCallback(async () => {
    setLoading(true);
    setError(null);
    const response = await calculateLandValueGrowth(
      parseFloat(todayValue),
      parseFloat(growthRate)
    );
    setLoading(false);
    if (response.success && response.data) {
      setResult(response.data);
    } else {
      setError(response.error || 'Failed to calculate');
    }
  }, [todayValue, growthRate]);

  // Example 2: Calculate locally (instant, no network)
  const handleCalculateLocal = useCallback(() => {
    setError(null);
    const response = calculateLandValueLocal(
      parseFloat(todayValue),
      parseFloat(growthRate)
    );
    if (response.success && response.data) {
      setResult(response.data);
    } else {
      setError(response.error || 'Failed to calculate');
    }
  }, [todayValue, growthRate]);

  // Example 3: Project growth over a year
  const handleProjectGrowth = useCallback(() => {
    setError(null);
    const response = projectLandValueGrowth(
      parseFloat(todayValue),
      parseFloat(growthRate),
      365 // 1 year
    );
    if (response.success && response.data) {
      setResult(response.data);
    } else {
      setError(response.error || 'Failed to project');
    }
  }, [todayValue, growthRate]);

  // Example 4: Calculate required growth rate
  const handleCalculateRequiredRate = useCallback(() => {
    setError(null);
    const targetValue = parseFloat(todayValue) * 1.1; // 10% increase
    const response = calculateRequiredGrowthRate(
      parseFloat(todayValue),
      targetValue,
      365
    );
    if (response.success) {
      setError(`Required daily growth rate for 10% return in 365 days: ${response.requiredRate}%`);
    } else {
      setError(response.error || 'Failed to calculate');
    }
  }, [todayValue]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Land Value Growth Calculator</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Today's Value (₹)</Text>
        <TextInput
          style={styles.input}
          placeholder="100000"
          value={todayValue}
          onChangeText={setTodayValue}
          keyboardType="decimal-pad"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Growth Rate (%)</Text>
        <TextInput
          style={styles.input}
          placeholder="0.001"
          value={growthRate}
          onChangeText={setGrowthRate}
          keyboardType="decimal-pad"
        />
      </View>

      <View style={styles.buttonGroup}>
        <TouchableOpacity
          style={[styles.button, styles.buttonPrimary]}
          onPress={handleCalculateLocal}
        >
          <Text style={styles.buttonText}>Calculate Local</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonPrimary]}
          onPress={handleCalculateWithBackend}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Calculate (Backend)</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.buttonGroup}>
        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={handleProjectGrowth}
        >
          <Text style={styles.buttonText}>Project 1 Year</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={handleCalculateRequiredRate}
        >
          <Text style={styles.buttonText}>Calc Required Rate</Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {result && (
        <View style={styles.resultBox}>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Today's Value:</Text>
            <Text style={styles.resultValue}>₹{result.todayValue.toLocaleString()}</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Growth Rate:</Text>
            <Text style={styles.resultValue}>{result.growthRate}%</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Tomorrow's Value:</Text>
            <Text style={styles.resultValue}>₹{result.tomorrowValue.toLocaleString()}</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Growth Amount:</Text>
            <Text style={[styles.resultValue, styles.growthAmount]}>
              +₹{result.growthAmount.toLocaleString()}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#16C784',
  },
  buttonSecondary: {
    backgroundColor: '#60A5FA',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: '#fecaca',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#dc2626',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
  },
  resultBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  resultValue: {
    fontSize: 15,
    color: '#333',
    fontWeight: '700',
  },
  growthAmount: {
    color: '#16C784',
  },
});
