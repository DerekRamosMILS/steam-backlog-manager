import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Dimensions,
  Switch,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Slider from '@react-native-community/slider';
import { useGames } from '../hooks/useGames';
import { GameCover } from '../components/GameCover';
import { SessionTimerModal } from '../components/SessionTimerModal';
import { enrichGameWithHLTB } from '../services/howLongToBeatService';
import { logSessionAndUpdateGame } from '../services/gamingSessionService';
import { getGamingSessionsForGame } from '../database/queries';
import { useAppContext } from '../hooks/useAppContext';
import {
  formatMinutes,
  formatHLTBTime,
  formatLastPlayed,
  formatRemainingTime,
  getRemainingMinutes,
} from '../utils/formatters';
import { Game, GameStatus, GamePriority, Platform as GamePlatform, STATUS_CONFIG, PRIORITY_CONFIG } from '../types';
import { ED, edStyles, MONO_FONT, STATUS_COLORS, coverPaletteFor } from '../styles/editorial';

const { width } = Dimensions.get('window');
const COVER_HEIGHT = Math.round(width * 0.55);

export default function GameDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { language } = useAppContext();
  const lang = (language ?? 'en') as string;
  const { getById, setStatus, setPriority, setProgress, setNotes, remove, refresh, setBacklogExclusion } = useGames();

  const [game, setGame] = useState<Game | null>(null);
  const [notes, setNotesLocal] = useState('');
  const [sessionMinutes, setSessionMinutes] = useState('');
  const [fetching, setFetching] = useState(false);
  const [timerVisible, setTimerVisible] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);

  const load = useCallback(() => {
    const g = getById(Number(id));
    setGame(g);
    setNotesLocal(g?.notes ?? '');
    if (g) {
      const s = getGamingSessionsForGame(g.id);
      setSessions(s as any[]);
    }
  }, [id, getById]);

  useEffect(() => {
    refresh();
    load();
  }, [load]);

  const handleStatusChange = (status: GameStatus) => {
    if (!game) return;
    setStatus(game.id, status);
    setGame(g => g ? { ...g, status } : g);
  };

  const handlePriorityChange = (priority: GamePriority) => {
    if (!game) return;
    setPriority(game.id, priority);
    setGame(g => g ? { ...g, priority } : g);
  };

  const handleProgressChange = (value: number) => {
    if (!game) return;
    const pct = Math.round(value);
    setProgress(game.id, pct);
    setGame(g => g ? { ...g, progress_percentage: pct } : g);
  };

  const handleSaveNotes = () => {
    if (!game) return;
    setNotes(game.id, notes);
    Alert.alert('Saved', 'Notes saved.');
  };

  const handleFetchHLTB = async () => {
    if (!game) return;
    setFetching(true);
    const result = await enrichGameWithHLTB(game.id);
    setFetching(false);
    refresh();
    load();
    if (result.status === 'not_found') Alert.alert('Not found', 'Could not find this game on HowLongToBeat.');
    if (result.status === 'request_failed') Alert.alert('HLTB failed', result.errorMessage ?? 'Request blocked.');
  };

  const handleLogSession = () => {
    if (!game) return;
    const mins = parseInt(sessionMinutes, 10);
    if (isNaN(mins) || mins <= 0) { Alert.alert('Invalid', 'Enter a valid number of minutes.'); return; }
    logSessionAndUpdateGame(game, mins);
    setSessionMinutes('');
    refresh();
    load();
  };

  const handleDelete = () => {
    Alert.alert('Remove Game', 'Remove this game from your library?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => { if (game) remove(game.id); router.back(); } },
    ]);
  };

  if (!game) {
    return (
      <View style={s.root}>
        <TouchableOpacity style={s.backBtnAlt} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={ED.ink} />
        </TouchableOpacity>
        <Text style={{ color: ED.ink3, padding: 40, textAlign: 'center' }}>Game not found.</Text>
      </View>
    );
  }

  const statusInfo = STATUS_COLORS[game.status] ?? STATUS_COLORS['not_started'];
  const pal = coverPaletteFor(game.title);
  const remainingMinutes = getRemainingMinutes(game.hltb_main_story, game.playtime_minutes);
  const avgSession = sessions.length > 0
    ? Math.round(sessions.reduce((a, s) => a + (s.duration_minutes ?? 0), 0) / sessions.length)
    : null;

  return (
    <View style={s.root}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={true}>

        {/* ── Cover hero ── */}
        <View style={{ height: COVER_HEIGHT, position: 'relative' }}>
          {game.cover_url ? (
            <GameCover uri={game.cover_url} width={width} height={COVER_HEIGHT} radius={0} />
          ) : (
            <View style={[s.coverPlaceholder, { backgroundColor: pal.b }]}>
              <View style={[s.coverGlow, { backgroundColor: pal.a }]} />
              <Text style={s.coverTitle} numberOfLines={3}>{game.title}</Text>
            </View>
          )}
          {/* Gradient overlay */}
          <View style={s.heroGradient} />

          {/* Nav buttons */}
          <View style={s.heroNav}>
            <TouchableOpacity style={s.circleBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={18} color={ED.ink} />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={s.circleBtn} onPress={() => router.push('/share' as any)}>
                <Ionicons name="share-outline" size={16} color={ED.ink} />
              </TouchableOpacity>
              <TouchableOpacity style={[s.circleBtn, { backgroundColor: 'rgba(193,104,71,0.6)' }]} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={16} color={ED.rust} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Title block ── */}
        <View style={s.titleBlock}>
          <Text style={[edStyles.eyebrow, { marginBottom: 6, color: ED.ink3 }]}>
            {game.platform.toUpperCase()}{game.release_year ? ` · ${game.release_year}` : ''}
          </Text>
          <Text style={[edStyles.displayTitle, { fontSize: 34, lineHeight: 36 }]} numberOfLines={2}>{game.title}</Text>

          <View style={s.badgeRow}>
            <View style={[s.statusChip, { backgroundColor: statusInfo.bg, borderColor: statusInfo.color + '40' }]}>
              <View style={[s.statusDot, { backgroundColor: statusInfo.color }]} />
              <Text style={[s.statusChipText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
            </View>
            {game.priority && (
              <View style={[edStyles.chip]}>
                <Text style={[edStyles.chipText, { color: game.priority === 'high' ? ED.rust : game.priority === 'medium' ? ED.amber : ED.ink3 }]}>
                  {game.priority === 'high' ? '↑ High' : game.priority === 'medium' ? '→ Med' : '↓ Low'}
                </Text>
              </View>
            )}
            <View style={edStyles.pill}>
              <Text style={edStyles.pillText}>{game.platform.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        <View style={s.content}>

          {/* ── Progress centerpiece ── */}
          <View style={[edStyles.card, s.section]}>
            <View style={{ padding: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={edStyles.eyebrow}>Progress</Text>
                <Text style={[s.lastPlayed]}>
                  last played {formatLastPlayed(game.last_played ? new Date(game.last_played).getTime() / 1000 : null)}
                </Text>
              </View>
              <View style={s.progressNumRow}>
                <Text style={s.progressNum}>{game.progress_percentage}</Text>
                <Text style={s.progressUnit}>%</Text>
              </View>
              <View style={edStyles.progressBar}>
                <View style={[edStyles.progressFill, { width: `${game.progress_percentage}%` as any }]} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                <Text style={s.progressMeta}>
                  <Text style={{ color: ED.ink }}>{formatMinutes(game.playtime_minutes)}</Text> played
                </Text>
                {remainingMinutes !== null && (
                  <Text style={s.progressMeta}>
                    <Text style={{ color: ED.ink }}>{formatRemainingTime(game.hltb_main_story, game.playtime_minutes)}</Text> left
                  </Text>
                )}
              </View>

              {/* Slider */}
              <Text style={[s.sliderHint]}>Drag to update</Text>
              <Slider
                minimumValue={0}
                maximumValue={100}
                step={5}
                value={game.progress_percentage}
                onSlidingComplete={handleProgressChange}
                minimumTrackTintColor={ED.copper}
                maximumTrackTintColor={ED.surface3}
                thumbTintColor={ED.copper}
                style={{ marginTop: 4 }}
              />
            </View>
          </View>

          {/* ── Primary CTAs ── */}
          <View style={[s.section, { flexDirection: 'row', gap: 10 }]}>
            <TouchableOpacity
              style={[edStyles.btn, edStyles.btnPrimary, { flex: 1, height: 50 }]}
              onPress={() => setTimerVisible(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="play" size={16} color="#1A1108" />
              <Text style={[edStyles.btnText, edStyles.btnPrimaryText, { fontSize: 15 }]}>
                {lang === 'es' ? 'Empezar sesión' : 'Start session'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[edStyles.btn, { width: 50, height: 50, paddingHorizontal: 0 }]}
              onPress={() => {}}
              activeOpacity={0.8}
            >
              <Ionicons name="create-outline" size={18} color={ED.ink2} />
            </TouchableOpacity>
          </View>

          {/* ── Spec table ── */}
          <View style={s.section}>
            <View style={edStyles.sectionHead}>
              <Text style={edStyles.eyebrow}>Specs</Text>
              <TouchableOpacity onPress={handleFetchHLTB} disabled={fetching}>
                <Ionicons name={fetching ? 'sync' : 'refresh-outline'} size={14} color={ED.copper} />
              </TouchableOpacity>
            </View>
            <View style={edStyles.card}>
              <SpecRow label="Main story" value={formatHLTBTime(game.hltb_main_story)} />
              <SpecRow label="+ Extras" value={formatHLTBTime(game.hltb_extra)} />
              <SpecRow label="Completionist" value={formatHLTBTime(game.hltb_completionist)} />
              {remainingMinutes !== null && (
                <SpecRow label="Remaining" value={formatRemainingTime(game.hltb_main_story, game.playtime_minutes)} accent />
              )}
              <SpecRow label="Platform" value={game.platform.charAt(0).toUpperCase() + game.platform.slice(1)} />
              {game.release_year ? <SpecRow label="Released" value={String(game.release_year)} last /> : null}
            </View>
          </View>

          {/* ── Recent sessions ── */}
          {sessions.length > 0 && (
            <View style={s.section}>
              <View style={edStyles.sectionHead}>
                <Text style={edStyles.eyebrow}>Recent sessions</Text>
                <Text style={[edStyles.eyebrow, { color: ED.ink3 }]}>{sessions.length} total</Text>
              </View>
              <View style={edStyles.card}>
                {sessions.slice(0, 5).map((sess, idx) => {
                  const barWidth = Math.min(100, Math.round((sess.duration_minutes / 180) * 100));
                  const d = sess.session_date ? new Date(sess.session_date) : null;
                  const dateStr = d ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '—';
                  return (
                    <View
                      key={sess.id ?? idx}
                      style={[s.sessRow, idx < Math.min(4, sessions.length - 1) && { borderBottomWidth: 1, borderBottomColor: ED.line }]}
                    >
                      <Text style={s.sessDate}>{dateStr}</Text>
                      <View style={s.sessBarTrack}>
                        <View style={[s.sessBarFill, { width: `${barWidth}%` as any }]} />
                      </View>
                      <Text style={s.sessDur}>
                        {Math.floor(sess.duration_minutes / 60)}h {sess.duration_minutes % 60}m
                      </Text>
                    </View>
                  );
                })}
              </View>
              {avgSession && (
                <Text style={s.sessAvg}>Average <Text style={{ color: ED.ink, fontFamily: MONO_FONT }}>{avgSession}m</Text> per session</Text>
              )}
            </View>
          )}

          {/* ── Log session manually ── */}
          <View style={s.section}>
            <View style={edStyles.sectionHead}>
              <Text style={edStyles.eyebrow}>Log session</Text>
            </View>
            <View style={edStyles.card}>
              <View style={{ padding: 16, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <TextInput
                  style={s.minInput}
                  value={sessionMinutes}
                  onChangeText={setSessionMinutes}
                  placeholder="Minutes played"
                  placeholderTextColor={ED.ink4}
                  keyboardType="numeric"
                />
                <TouchableOpacity
                  style={[edStyles.btn, edStyles.btnPrimary, { height: 44, paddingHorizontal: 20 }]}
                  onPress={handleLogSession}
                  activeOpacity={0.8}
                >
                  <Text style={[edStyles.btnText, edStyles.btnPrimaryText]}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* ── Status grid ── */}
          <View style={s.section}>
            <View style={edStyles.sectionHead}>
              <Text style={edStyles.eyebrow}>Change status</Text>
            </View>
            <View style={s.statusGrid}>
              {(Object.keys(STATUS_CONFIG) as GameStatus[]).map((st) => {
                const cfg = STATUS_CONFIG[st];
                const sc = STATUS_COLORS[st];
                const active = game.status === st;
                return (
                  <TouchableOpacity
                    key={st}
                    style={[
                      s.statusBtn,
                      { borderColor: active ? sc.color : ED.line, backgroundColor: active ? sc.bg : ED.surface1 },
                    ]}
                    onPress={() => handleStatusChange(st)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name={cfg.icon as any} size={13} color={active ? sc.color : ED.ink3} />
                    <Text style={[s.statusBtnText, { color: active ? sc.color : ED.ink3 }]}>{sc.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Priority ── */}
          <View style={s.section}>
            <View style={edStyles.sectionHead}>
              <Text style={edStyles.eyebrow}>Priority</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(Object.keys(PRIORITY_CONFIG) as GamePriority[]).map((p) => {
                const cfg = PRIORITY_CONFIG[p];
                const active = game.priority === p;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[
                      edStyles.card,
                      s.priorityBtn,
                      active && { borderColor: cfg.color, backgroundColor: cfg.color + '18' },
                    ]}
                    onPress={() => handlePriorityChange(p)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name={cfg.icon as any} size={14} color={active ? cfg.color : ED.ink3} />
                    <Text style={[s.priorityBtnText, { color: active ? cfg.color : ED.ink3 }]}>{cfg.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Notes ── */}
          <View style={s.section}>
            <View style={edStyles.sectionHead}>
              <Text style={edStyles.eyebrow}>Notes</Text>
              <TouchableOpacity onPress={handleSaveNotes}>
                <Text style={{ fontFamily: MONO_FONT, fontSize: 11, fontWeight: '600', color: ED.copper }}>SAVE</Text>
              </TouchableOpacity>
            </View>
            <View style={edStyles.card}>
              <TextInput
                style={s.notesInput}
                value={notes}
                onChangeText={setNotesLocal}
                multiline
                numberOfLines={4}
                placeholder="Add notes, thoughts, or reminders…"
                placeholderTextColor={ED.ink4}
              />
            </View>
          </View>

          {/* ── Exclude from backlog ── */}
          <View style={[edStyles.card, s.section]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
              <View style={[s.rowIcon]}>
                <Ionicons name="eye-off-outline" size={15} color={ED.ink3} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.excludeLabel}>Exclude from backlog</Text>
                <Text style={s.excludeSub}>Won't appear in stats or recommendations</Text>
              </View>
              <Switch
                value={game.exclude_from_backlog === 1}
                onValueChange={(value) => {
                  setBacklogExclusion(game.id, value);
                  setGame(g => g ? { ...g, exclude_from_backlog: value ? 1 : 0 } : g);
                }}
                trackColor={{ false: ED.surface3, true: ED.skyBg }}
                thumbColor={game.exclude_from_backlog === 1 ? ED.sky : ED.ink3}
              />
            </View>
          </View>

          {/* ── Bottom actions ── */}
          <View style={[s.section, { flexDirection: 'row', justifyContent: 'center', gap: 28 }]}>
            <TouchableOpacity style={s.ghostAction} onPress={handleFetchHLTB} disabled={fetching}>
              <Ionicons name="refresh-outline" size={14} color={ED.ink3} />
              <Text style={s.ghostActionText}>Refresh HLTB</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.ghostAction} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={14} color={ED.rust} />
              <Text style={[s.ghostActionText, { color: ED.rust }]}>Remove</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 120 }} />
        </View>
      </ScrollView>

      <SessionTimerModal
        visible={timerVisible}
        game={game}
        onClose={(savedMinutes) => {
          setTimerVisible(false);
          if (savedMinutes) { refresh(); load(); }
        }}
      />
    </View>
  );
}

function SpecRow({ label, value, accent, last }: { label: string; value: string; accent?: boolean; last?: boolean }) {
  return (
    <View style={[edStyles.specRow, { paddingHorizontal: 16 }, last && { borderBottomWidth: 0 }]}>
      <Text style={edStyles.specKey}>{label}</Text>
      <Text style={[edStyles.specVal, accent && { color: ED.copper }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: ED.bg },

  backBtnAlt: { marginTop: Platform.OS === 'ios' ? 56 : 44, marginLeft: 16, width: 38, height: 38, borderRadius: 19, backgroundColor: ED.surface2, alignItems: 'center', justifyContent: 'center' },

  coverPlaceholder: {
    width: '100%' as any, height: '100%' as any,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  coverGlow: {
    position: 'absolute', bottom: -40, right: -40,
    width: width * 0.7, height: width * 0.7,
    borderRadius: width * 0.35, opacity: 0.4,
  },
  coverTitle: {
    fontFamily: MONO_FONT, fontSize: 14, fontWeight: '600',
    color: ED.ink3, textAlign: 'center', paddingHorizontal: 24,
    letterSpacing: 0.5, textTransform: 'uppercase',
  },
  heroGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 140,
    backgroundColor: 'transparent',
    // Simulated gradient via opacity overlay
  },
  heroNav: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 44,
    left: 16, right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  circleBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },

  titleBlock: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
    marginTop: -32,
    zIndex: 2,
  },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 100, borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusChipText: { fontSize: 11.5, fontWeight: '600', letterSpacing: -0.1 },

  content: { paddingHorizontal: 24 },
  section: { marginBottom: 24 },

  progressNumRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  progressNum: { fontSize: 64, fontWeight: '900', color: ED.copper, letterSpacing: -3 },
  progressUnit: { fontSize: 24, color: ED.ink3, fontWeight: '600' },
  lastPlayed: { fontFamily: MONO_FONT, fontSize: 10, color: ED.ink3 },
  progressMeta: { fontSize: 12, color: ED.ink3, fontFamily: MONO_FONT },
  sliderHint: { fontSize: 11, color: ED.ink4, marginTop: 10 },

  sessRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  sessDate: { fontFamily: MONO_FONT, fontSize: 10, color: ED.ink3, width: 80 },
  sessBarTrack: { flex: 1, height: 4, backgroundColor: ED.surface3, borderRadius: 100, overflow: 'hidden' },
  sessBarFill: { height: '100%' as any, backgroundColor: ED.moss, borderRadius: 100 },
  sessDur: { fontFamily: MONO_FONT, fontSize: 11, color: ED.ink, width: 56, textAlign: 'right' as const },
  sessAvg: { marginTop: 8, fontSize: 11, color: ED.ink3, fontFamily: MONO_FONT },

  minInput: {
    flex: 1, height: 44, borderRadius: 10,
    borderWidth: 1, borderColor: ED.line,
    backgroundColor: ED.surface2,
    paddingHorizontal: 12, fontSize: 14,
    color: ED.ink, fontFamily: MONO_FONT,
  },

  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statusBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1,
  },
  statusBtnText: { fontSize: 11.5, fontWeight: '500' },

  priorityBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 12,
  },
  priorityBtnText: { fontSize: 13, fontWeight: '600' },

  notesInput: {
    fontSize: 13.5, color: ED.ink2, lineHeight: 22,
    minHeight: 88, textAlignVertical: 'top' as const,
    padding: 16, fontStyle: 'italic',
  },

  rowIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: ED.surface2, alignItems: 'center', justifyContent: 'center' },
  excludeLabel: { fontSize: 13.5, fontWeight: '600', color: ED.ink },
  excludeSub: { fontSize: 11, color: ED.ink3, marginTop: 2 },

  ghostAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ghostActionText: { fontSize: 12.5, color: ED.ink3 },
});
