import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BacklogChallenge } from '../types';
import { ED, edStyles, MONO_FONT } from '../styles/editorial';
import { Language, StringKey, t } from '../i18n';

const LABEL_KEYS: Record<string, StringKey> = {
  games_completed: 'chal_games_completed',
  hours_played: 'chal_hours_played',
  hltb_target_met: 'chal_hltb_target_met',
};

function formatProgress(challenge: BacklogChallenge): string {
  // hours_played accumulates fractional hours; the others are whole counts.
  const shown =
    challenge.type === 'hours_played'
      ? challenge.progress.toFixed(1)
      : String(Math.round(challenge.progress));
  return `${shown}/${challenge.target}`;
}

export function MonthlyChallenges({
  challenges,
  lang,
}: {
  challenges: BacklogChallenge[];
  lang: Language;
}) {
  if (challenges.length === 0) return null;

  const done = challenges.filter((c) => c.status === 'completed').length;

  return (
    <View style={styles.section}>
      <View style={edStyles.sectionHead}>
        <Text style={[edStyles.eyebrow, { color: ED.copper }]}>◆ {t('chal_title', lang)}</Text>
        <Text style={[edStyles.eyebrow, { color: ED.ink4 }]}>
          <Text style={{ fontFamily: MONO_FONT }}>{done}/{challenges.length}</Text> {t('chal_done', lang)}
        </Text>
      </View>

      <View style={edStyles.card}>
        {challenges.map((c, i) => {
          const ratio = c.target > 0 ? Math.min(1, c.progress / c.target) : 0;
          const complete = c.status === 'completed';
          return (
            <View
              key={c.id}
              style={[styles.row, i < challenges.length - 1 && styles.rowBorder]}
            >
              <View style={styles.rowHead}>
                <Text style={[styles.label, complete && { color: ED.copper }]} numberOfLines={1}>
                  {LABEL_KEYS[c.type] ? t(LABEL_KEYS[c.type], lang) : c.type}
                </Text>
                {complete ? (
                  <Ionicons name="checkmark-circle" size={15} color={ED.copper} />
                ) : (
                  <Text style={[edStyles.eyebrow, { color: ED.ink3, fontFamily: MONO_FONT }]}>
                    {formatProgress(c)}
                  </Text>
                )}
              </View>
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    { width: `${ratio * 100}%`, backgroundColor: complete ? ED.copper : ED.ink3 },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 26 },
  row: { paddingVertical: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: ED.line },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 10,
  },
  label: { color: ED.ink2, fontSize: 13, flex: 1 },
  track: {
    height: 3,
    borderRadius: 2,
    backgroundColor: ED.surface3,
    overflow: 'hidden',
  },
  fill: { height: 3, borderRadius: 2 },
});
