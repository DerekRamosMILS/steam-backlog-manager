import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { ED } from '../styles/editorial';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;          // accepted for back-compat, unused
  tint?: 'dark' | 'light' | 'default'; // accepted for back-compat, unused
  padding?: number;
  radius?: number;
  borderColor?: string;
}

/**
 * Editorial card — drop-in replacement for the previous glassmorphism card.
 * Keeps the same prop surface (intensity / tint are ignored).
 */
export function GlassCard({
  children,
  style,
  padding = 16,
  radius = ED.radius,
  borderColor,
}: GlassCardProps) {
  return (
    <View
      style={[
        styles.wrapper,
        {
          borderRadius: radius,
          borderColor: borderColor ?? ED.line,
          backgroundColor: ED.surface1,
        },
        style,
      ]}
    >
      <View style={{ padding, borderRadius: radius, overflow: 'hidden' }}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderWidth: 1,
    overflow: 'hidden',
  },
});
