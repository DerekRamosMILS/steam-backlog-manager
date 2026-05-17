import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ED, edStyles, MONO_FONT } from '../styles/editorial';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  gradient?: readonly [string, string]; // accepted for back-compat, unused
  subtitle?: string;
}

export function StatCard({
  label,
  value,
  icon,
  color,
  subtitle,
}: StatCardProps) {
  const accent = color || ED.copper;

  return (
    <View style={styles.wrapper}>
      <View style={[styles.iconBg, { backgroundColor: accent + '22', borderColor: accent + '40' }]}>
        <Ionicons name={icon} size={16} color={accent} />
      </View>
      <Text style={[styles.value, { color: accent }]}>{value}</Text>
      <Text style={[edStyles.eyebrow, { marginTop: 2 }]}>{label}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    borderRadius: ED.radius,
    borderWidth: 1,
    borderColor: ED.line,
    backgroundColor: ED.surface1,
    padding: 14,
    overflow: 'hidden',
    minHeight: 110,
  },
  iconBg: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  value: {
    fontFamily: MONO_FONT,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: ED.ink,
  },
  subtitle: {
    fontSize: 10,
    color: ED.ink3,
    marginTop: 4,
  },
});
