import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ED, edStyles, MONO_FONT } from '../styles/editorial';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  action?: {
    label: string;
    onPress: () => void;
  };
  count?: number;
}

export function SectionHeader({
  title,
  subtitle,
  icon,
  iconColor,
  action,
  count,
}: SectionHeaderProps) {
  const accent = iconColor || ED.copper;

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {icon && (
          <View style={[styles.iconWrap, { backgroundColor: accent + '22', borderColor: accent + '40' }]}>
            <Ionicons name={icon} size={14} color={accent} />
          </View>
        )}
        <View>
          <View style={styles.titleRow}>
            <Text style={[edStyles.eyebrow, { color: accent }]}>{title.toUpperCase()}</Text>
            {count !== undefined && (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{count}</Text>
              </View>
            )}
          </View>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {action && (
        <TouchableOpacity onPress={action.onPress} activeOpacity={0.7}>
          <Text style={styles.action}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subtitle: {
    fontSize: 11,
    color: ED.ink3,
    marginTop: 2,
  },
  countBadge: {
    backgroundColor: ED.surface2,
    borderWidth: 1,
    borderColor: ED.line,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  countText: {
    fontFamily: MONO_FONT,
    fontSize: 10,
    fontWeight: '700',
    color: ED.ink2,
  },
  action: {
    fontSize: 12,
    fontWeight: '600',
    color: ED.copper,
  },
});
