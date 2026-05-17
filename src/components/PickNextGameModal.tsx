import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Recommendation } from '../types';
import { GameCover } from './GameCover';
import { formatHLTBTime } from '../utils/formatters';
import { useAppContext } from '../hooks/useAppContext';
import { t, Language } from '../i18n';
import { ED, edStyles, MONO_FONT, STATUS_COLORS, coverPaletteFor } from '../styles/editorial';

const { width } = Dimensions.get('window');

interface Props {
  visible: boolean;
  recommendation: Recommendation | null;
  onReroll: (hours?: number) => void;
  onClose: () => void;
}

function getSessionOptions(lang: Language) {
  return [
    { label: t('modal_session_any', lang), value: undefined },
    { label: t('modal_session_1hr', lang), value: 1 },
    { label: t('modal_session_2hr', lang), value: 2 },
    { label: t('modal_session_4hr', lang), value: 4 },
  ];
}

export function PickNextGameModal({ visible, recommendation, onReroll, onClose }: Props) {
  const router = useRouter();
  const { language } = useAppContext();
  const [sessionHours, setSessionHours] = useState<number | undefined>(undefined);
  const SESSION_OPTIONS = getSessionOptions(language as Language);

  const handleOpen = () => {
    onClose();
    if (recommendation) router.push(`/game/${recommendation.game.id}` as any);
  };

  const rec = recommendation;

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      {/* Backdrop */}
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />

      {/* Bottom sheet */}
      <View style={s.sheet}>
        {/* Handle */}
        <View style={s.handle} />

        {/* Header */}
        <View style={s.sheetHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[edStyles.eyebrow, { color: ED.copper, marginBottom: 6 }]}>◆ AI PICKED</Text>
            <Text style={[edStyles.displayTitle, { fontSize: 30 }]}>Pick this one.</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={20} color={ED.ink3} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {rec ? (
            <>
              {/* Cover art */}
              <View style={s.coverWrap}>
                {rec.game.cover_url ? (
                  <GameCover
                    uri={rec.game.cover_url}
                    width={width - 48}
                    height={220}
                    radius={16}
                  />
                ) : (
                  <View style={[s.coverPlaceholder, { backgroundColor: coverPaletteFor(rec.game.title).b }]}>
                    <Text style={s.coverPlaceholderText} numberOfLines={2}>{rec.game.title}</Text>
                  </View>
                )}
                {/* Match badge */}
                <View style={s.matchBadge}>
                  <Text style={s.matchBadgeText}>★ {rec.score}% MATCH</Text>
                </View>
              </View>

              {/* Title */}
              <Text style={s.recTitle}>{rec.game.title}</Text>

              {/* Chips */}
              <View style={s.chipRow}>
                {rec.game.status && (
                  <View style={[edStyles.chip, { borderColor: STATUS_COLORS[rec.game.status]?.color + '40', backgroundColor: STATUS_COLORS[rec.game.status]?.bg }]}>
                    <Text style={[edStyles.chipText, { color: STATUS_COLORS[rec.game.status]?.color }]}>
                      {STATUS_COLORS[rec.game.status]?.label}
                    </Text>
                  </View>
                )}
                {rec.game.hltb_main_story ? (
                  <View style={edStyles.chip}>
                    <Ionicons name="time-outline" size={10} color={ED.ink3} />
                    <Text style={edStyles.chipText}>{formatHLTBTime(rec.game.hltb_main_story)} main</Text>
                  </View>
                ) : null}
                {rec.badges.slice(0, 2).map(b => (
                  <View key={b} style={edStyles.pill}>
                    <Text style={edStyles.pillText}>{b}</Text>
                  </View>
                ))}
              </View>

              {/* Why this? */}
              <View style={s.whyCard}>
                <Text style={[edStyles.eyebrow, { color: ED.copper, marginBottom: 8 }]}>WHY THIS?</Text>
                <Text style={s.whyText}>{rec.reason}</Text>
                {rec.whyNot && (
                  <Text style={s.whyNotText}>But: {rec.whyNot}</Text>
                )}
              </View>

              {/* Spec rows */}
              <View style={[edStyles.card, { marginTop: 12 }]}>
                {[
                  { key: 'Priority', val: rec.game.priority },
                  rec.game.hltb_main_story ? { key: 'Main story', val: formatHLTBTime(rec.game.hltb_main_story) } : null,
                  { key: 'Platform', val: rec.game.platform },
                  { key: 'Days waiting', val: `${rec.daysWaiting}d` },
                ].filter(Boolean).map((row, idx, arr) => (
                  <View
                    key={row!.key}
                    style={[edStyles.specRow, { paddingHorizontal: 16 }, idx === arr.length - 1 && { borderBottomWidth: 0 }]}
                  >
                    <Text style={edStyles.specKey}>{row!.key}</Text>
                    <Text style={edStyles.specVal}>{row!.val}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <View style={s.empty}>
              <Ionicons name="library-outline" size={48} color={ED.ink4} />
              <Text style={s.emptyTitle}>{t('modal_empty', language as Language)}</Text>
              <Text style={s.emptySubText}>{t('modal_empty_sub', language as Language)}</Text>
            </View>
          )}

          {/* Session filter */}
          <View style={s.sessionWrap}>
            <Text style={edStyles.eyebrow}>Session length</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
              {SESSION_OPTIONS.map((opt) => {
                const active = sessionHours === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.label}
                    style={[s.sessionChip, active && s.sessionChipActive]}
                    onPress={() => { setSessionHours(opt.value); onReroll(opt.value); }}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.sessionChipText, active && s.sessionChipTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={{ height: 20 }} />
        </ScrollView>

        {/* Bottom actions */}
        <View style={s.actions}>
          <TouchableOpacity style={[edStyles.btn, s.rerollBtn]} onPress={() => onReroll(sessionHours)} activeOpacity={0.8}>
            <Ionicons name="refresh-outline" size={14} color={ED.ink2} />
            <Text style={edStyles.btnText}>Reroll</Text>
          </TouchableOpacity>
          {rec && (
            <TouchableOpacity
              style={[edStyles.btn, edStyles.btnPrimary, s.playBtn]}
              onPress={handleOpen}
              activeOpacity={0.85}
            >
              <Text style={[edStyles.btnText, edStyles.btnPrimaryText, { fontSize: 15 }]}>Play this</Text>
              <Ionicons name="arrow-forward" size={14} color="#1A1108" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: ED.surface1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: ED.line,
    maxHeight: '90%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 100,
    backgroundColor: ED.ink4,
    alignSelf: 'center', marginTop: 14, marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 14, paddingBottom: 8,
  },
  scroll: { paddingHorizontal: 24, paddingTop: 8 },

  coverWrap: { position: 'relative', marginBottom: 16 },
  coverPlaceholder: {
    width: width - 48, height: 220, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  coverPlaceholderText: {
    fontFamily: MONO_FONT, fontSize: 14, color: ED.ink3,
    textAlign: 'center', paddingHorizontal: 24,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  matchBadge: {
    position: 'absolute', top: 12, left: 12,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 100,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  matchBadgeText: {
    fontFamily: MONO_FONT, fontSize: 11, fontWeight: '600', color: ED.copper,
  },

  recTitle: {
    fontSize: 26, fontWeight: '800', color: ED.ink,
    letterSpacing: -1, lineHeight: 30, marginBottom: 12,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },

  whyCard: {
    padding: 16, borderRadius: 12,
    backgroundColor: ED.surface2, borderWidth: 1, borderColor: ED.line,
  },
  whyText: { fontSize: 14, color: ED.ink2, lineHeight: 22 },
  whyNotText: { fontSize: 12, color: ED.ink3, marginTop: 6, fontStyle: 'italic' },

  sessionWrap: { marginTop: 16 },
  sessionChip: {
    flex: 1, height: 34, borderRadius: 8, borderWidth: 1, borderColor: ED.line,
    alignItems: 'center', justifyContent: 'center', backgroundColor: ED.surface2,
  },
  sessionChipActive: { backgroundColor: ED.copperBg, borderColor: ED.copperLine },
  sessionChipText: { fontFamily: MONO_FONT, fontSize: 12, fontWeight: '600', color: ED.ink2 },
  sessionChipTextActive: { color: ED.copper },

  empty: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: ED.ink },
  emptySubText: { fontSize: 13, color: ED.ink3, textAlign: 'center', lineHeight: 18 },

  actions: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 24, paddingTop: 12,
    paddingBottom: 36,
    borderTopWidth: 1, borderTopColor: ED.line,
  },
  rerollBtn: { width: 110 },
  playBtn: { flex: 1, height: 50 },
});
