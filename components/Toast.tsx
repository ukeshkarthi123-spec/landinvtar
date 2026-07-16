import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { Check, AlertCircle, Info, X } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastRef {
  show: (message: string, type?: ToastType) => void;
}

const Toast = forwardRef<ToastRef>((props, ref) => {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<ToastType>('info');
  const opacity = useState(new Animated.Value(0))[0];

  const show = useCallback((msg: string, t: ToastType = 'info') => {
    setMessage(msg);
    setType(t);
    setVisible(true);

    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(3000),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setVisible(false));
  }, [opacity]);

  useImperativeHandle(ref, () => ({
    show,
  }));

  if (!visible) return null;

  const getIcon = () => {
    switch (type) {
      case 'success': return <Check size={18} color="#fff" />;
      case 'error': return <AlertCircle size={18} color="#fff" />;
      case 'info': return <Info size={18} color="#fff" />;
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'success': return '#10B981';
      case 'error': return '#EF4444';
      case 'info': return '#3B82F6';
    }
  };

  return (
    <Animated.View style={[styles.container, { opacity, backgroundColor: getBgColor() }]}>
      <View style={styles.icon}>{getIcon()}</View>
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 80,
    left: 20,
    right: 20,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  icon: { marginRight: 12 },
  text: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 },
});

export default Toast;
