import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t, Language } from '../i18n';
import { Game } from '../types';
import { logSessionAndUpdateGame } from '../services/gamingSessionService';
import { useAppContext } from '../hooks/useAppContext';
import { ED, edStyles, MONO_FONT } from '../styles/editorial';

interface Props {
  visible: boolean;
  game: Game;
  onClose: (savedMinutes?: number) => void;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatElapsed(seconds: number): { main: string; sec: string } {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return { main: `${pad(h)}:${pad(m)}`, sec: `:${pad(s)}` };
  return { main: `${pad(m)}`, sec: `:${pad(s)}` };
}

export function SessionTimerModal({ visible, game, onClose }: Props) {
  const { language } = useAppContext();
  const lang = language as Language;

  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (visible) {
      setElapsed(0);
      setRunning(true);
    } else {
      setRunning(false);
      setElapsed(0);
    }
  }, [visible]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const elapsedMinutes = Math.max(1, Math.round(elapsed / 60));
  const { main, sec } = formatElapsed(elapsed);

  const sessionNum = game.playtime_minutes > 0 ? Math.ceil(game.playtime_minutes / 60) + 1 : 1;
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const now = new Date();
  const dayStr = `Session #${sessionNum} · ${dayNames[now.getDay()]} evening`;

  const handleEnd = useCallback(() => {
    setRunning(false);
    Alert.alert(
      t('session_end_confirm', lang),
      `${t('session_end_msg', lang)} ${elapsedMinutes} ${t('session_end_msg2', lang)}`,
      [
        { text: t('session_cancel_btn', lang), onPress: () => setRunning(true) },
        {
          text: t('session_save', lang),
          onPress: () => {
            logSessionAndUpdateGame(game, elapsedMinutes);
            Alert.alert(t('session_saved', lang), `${elapsedMinutes} ${t('session_saved_msg', lang)}`);
            onClose(elapsedMinutes);
          },
        },
      ]
    );
  }, [lang, elapsedMinutes, game, onClose]);

  const handleDiscard = useCallback(() => {
    setRunning(false);
    Alert.alert(
      t('session_discard', lang),
      t('session_discard_msg', lang),
      [
        { text: t('session_cancel_btn', lang), onPress: () => setRunning(true) },
        { text: t('session_discard', lang), style: 'destructive', onPress: () => onClose() },
      ]
    );
  }, [lang, onClose]);

  const progressHours = Math.round(game.playtime_minutes / 60);

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={handleDiscard}>
      <Pressable style={StyleSheet.absoluteFillObject} onPress={() => {}} />

      <View style={s.root}>
        {/* Top bar */}
        <View style={s.topBar}>
          <TouchableOpacity style={s.closeBtn} onPress={handleDiscard}>
            <Ionicons name="close" size={16} color={ED.ink} />
          </TouchableOpacity>
          <View style={s.activePill}>
            <View style={s.activeDot} />
            <Text style={s.activePillText}>SESSION ACTIVE</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* Game info */}
        <View style={s.gameInfo}>
          <Text style={edStyles.eyebrow}>NOW PLAYING</Text>
          <Text style={s.gameTitle} numberOfLines={2}>{game.title}</Text>
          <Text style={s.gameSub}>{dayStr}</Text>
        </View>

        {/* Clock */}
        <View style={s.clockWrap}>
          {/* Progress ring approximated with a View border */}
          <View style={[s.ringOuter, !running && s.ringPaused]}>
            <View style={s.clockInner}>
              <View style={s.timeRow}>
                <Text style={s.timeMain}>{main}</Text>
                <Text style={s.timeSec}>{sec}</Text>
              </View>
              <Text style={[edStyles.eyebrow, { marginTop: 12 }]}>
                {running ? 'SESSION DURATION' : 'PAUSED'}
              </Text>
            </View>
          </View>

          {/* Stats below clock */}
          <View style={s.statsRow}>
            <View style={s.statItem}>
              <Text style={s.statVal}>
                +{Math.max(0, Math.round(elapsed / 1800))}
                <Text style={s.statUnit}>%</Text>
              </Text>
              <Text style={edStyles.eyebrow}>PROGRESS</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={[s.statVal, { color: ED.moss }]}>
                {progressHours}
                <Text style={s.statUnit}>h</Text>
              </Text>
              <Text style={edStyles.eyebrow}>TOTAL PLAYED</Text>
            </View>
          </View>
        </View>

        {/* Controls */}
        <View style={s.controls}>
          <TouchableOpacity
            style={[s.sideBtn]}
            onPress={() => setRunning(r => !r)}
            activeOpacity={0.8}
          >
            <Ionicons name={running ? 'pause' : 'play'} size={20} color={ED.ink2} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[edStyles.btn, edStyles.btnPrimary, s.endBtn]}
            onPress={handleEnd}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark" size={16} color="#1A1108" />
            <Text style={[edStyles.btnText, edStyles.btnPrimaryText, { fontSize: 15 }]}>
              End & save
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.sideBtn} onPress={() => {}} activeOpacity={0.8}>
            <Ionicons name="create-outline" size={20} color={ED.ink2} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(8,6,4,0.97)',
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
    justifyContent: 'space-between',
  },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: 14,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  activePill: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ED.copper },
  activePillText: {
    fontFamily: MONO_FONT, fontSize: 11, fontWeight: '600',
    color: ED.copper, letterSpacing: 1.2,
  },

  gameInfo: { alignItems: 'center', gap: 6, paddingVertical: 16 },
  gameTitle: {
    fontSize: 28, fontWeight: '800', color: ED.ink,
    letterSpacing: -1, lineHeight: 32, textAlign: 'center',
  },
  gameSub: { fontFamily: MONO_FONT, fontSize: 11, color: ED.ink3 },

  clockWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 36 },
  ringOuter: {
    width: 220, height: 220, borderRadius: 110,
    borderWidth: 2, borderColor: ED.copper,
    alignItems: 'center', justifyContent: 'center',
    // Outer dim ring
    shadowColor: ED.copper,
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  ringPaused: { borderColor: ED.ink3 },
  clockInner: { alignItems: 'center' },
  timeRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  timeMain: {
    fontFamily: MONO_FONT, fontSize: 68, fontWeight: '700',
    color: ED.ink, letterSpacing: -3, lineHeight: 72,
  },
  timeSec: { fontFamily: MONO_FONT, fontSize: 22, color: ED.ink3, lineHeight: 28 },

  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 28 },
  statItem: { alignItems: 'center', gap: 6 },
  statVal: { fontSize: 22, fontWeight: '700', color: ED.ink, letterSpacing: -0.5 },
  statUnit: { fontSize: 13, color: ED.ink3, fontWeight: '400' },
  statDivider: { width: 1, height: 36, backgroundColor: ED.line },

  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingBottom: 8,
  },
  sideBtn: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },
  endBtn: { flex: 1, height: 52, borderRadius: 14 },
});
