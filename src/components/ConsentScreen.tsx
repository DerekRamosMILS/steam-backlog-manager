import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PLATFORM_CONFIG, ImportPlatform } from '../types';
import { ED, edStyles } from '../styles/editorial';

interface ConsentScreenProps {
  platform: ImportPlatform;
  onAccept: () => void;
  onCancel: () => void;
}

export function ConsentScreen({ platform, onAccept, onCancel }: ConsentScreenProps) {
  const config = PLATFORM_CONFIG[platform];

  const bullets = [
    `Your credentials are entered directly on ${config.label}'s official website`,
    'Your login session stays on your device only',
    `BacklogFlow is not affiliated with ${config.label}`,
    'We never see, store, or transmit your password',
    'You can disconnect anytime from Settings',
  ];

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="shield-checkmark-outline" size={32} color={ED.copper} />
      </View>

      <Text style={[edStyles.eyebrow, { color: ED.copper, marginTop: 4 }]}>PRIVACY NOTICE</Text>
      <Text style={styles.title}>Before connecting {config.label}</Text>
      <Text style={styles.subtitle}>
        How your data is handled — read carefully.
      </Text>

      <View style={styles.bulletList}>
        {bullets.map((text, i) => (
          <View key={i} style={styles.bulletRow}>
            <Ionicons name="checkmark-circle" size={15} color={ED.moss} />
            <Text style={styles.bulletText}>{text}</Text>
          </View>
        ))}
      </View>

      <View style={styles.disclaimer}>
        <Ionicons name="information-circle-outline" size={13} color={ED.ink3} />
        <Text style={styles.disclaimerText}>
          This app is an independent project. All trademarks belong to their respective owners.
        </Text>
      </View>

      <TouchableOpacity style={styles.acceptBtn} onPress={onAccept} activeOpacity={0.85}>
        <Ionicons name="shield-checkmark" size={16} color="#1A1108" />
        <Text style={styles.acceptText}>I Understand, Continue</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  iconWrap: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: ED.copperBg, borderWidth: 1, borderColor: ED.copperLine,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: ED.ink,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: ED.ink3,
    textAlign: 'center',
    marginBottom: 4,
  },
  bulletList: { alignSelf: 'stretch', gap: 10, marginVertical: 8 },
  bulletRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingRight: 8,
  },
  bulletText: { fontSize: 13, lineHeight: 19, flex: 1, color: ED.ink2 },
  disclaimer: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderRadius: 12, borderWidth: 1, borderColor: ED.line,
    backgroundColor: ED.surface2, padding: 12, alignSelf: 'stretch',
  },
  disclaimerText: { fontSize: 11, lineHeight: 16, flex: 1, color: ED.ink3 },
  acceptBtn: {
    height: 50, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: ED.copper,
    alignSelf: 'stretch', marginTop: 6,
  },
  acceptText: { color: '#1A1108', fontSize: 15, fontWeight: '700' },
  cancelBtn: { paddingVertical: 8 },
  cancelText: { fontSize: 13, color: ED.ink3, textDecorationLine: 'underline' },
});
