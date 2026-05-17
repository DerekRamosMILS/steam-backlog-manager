import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { GameCover } from '../components/GameCover';
import { useAppContext } from '../hooks/useAppContext';
import { t, Language, StringKey } from '../i18n';
import { trackEvent } from '../services/analyticsService';
import { searchGamesByTitle } from '../services/gameSearchService';
import { searchHLTB } from '../api/hltb';
import { getBacklogStats, getAllGames } from '../database/queries';
import { ManualGameSearchResult, Game } from '../types';
import { ED, edStyles, MONO_FONT } from '../styles/editorial';

const SCREEN_W = Dimensions.get('window').width;

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'search' | 'analyzing' | 'verdict';
type Motivation = 'everyone' | 'sale' | 'interested' | 'fomo' | 'curious' | 'waiting';
type Timing = 'now' | 'soon' | 'eventually' | 'never';
type VerdictLevel = 'green' | 'yellow' | 'red' | 'go';

interface VerdictData {
  level: VerdictLevel;
  gameTitle: string;
  gameCover: string | null;
  gameHours: number | null;
  totalGames: number;
  backlogHoursBefore: number;
  backlogHoursAfter: number;
  finishYearBefore: number;
  finishYearAfter: number;
  similarGames: Game[];
  playerName: string;
}

// ─── Verdict logic ────────────────────────────────────────────────────────────

function computeVerdict(motivation: Motivation, timing: Timing, backlogHours: number): VerdictLevel {
  if ((motivation === 'waiting' || motivation === 'interested') && timing === 'now') return 'go';
  if (timing === 'never') return 'red';
  if (backlogHours < 150) return 'green';
  if (backlogHours < 400) {
    return motivation === 'curious' || motivation === 'fomo' || motivation === 'everyone' ? 'yellow' : 'green';
  }
  if (motivation === 'curious' || motivation === 'fomo') return 'red';
  return 'yellow';
}

function findSimilarGames(target: ManualGameSearchResult, allGames: Game[]): Game[] {
  const active = allGames.filter((g) => g.status !== 'completed' && g.status !== 'abandoned');
  const targetWords = target.title.toLowerCase().split(/\s+/);
  const scored = active.map((g) => {
    const gWords = g.title.toLowerCase().split(/\s+/);
    const overlap = targetWords.filter((w) => gWords.includes(w)).length;
    return { game: g, score: overlap };
  });
  const withHltb = scored.filter((s) => s.game.hltb_main_story !== null)
    .sort((a, b) => b.score - a.score).slice(0, 3).map((s) => s.game);
  if (withHltb.length >= 2) return withHltb;
  const fallback = active.filter((g) => g.status === 'up_next' || g.status === 'playing').slice(0, 3);
  return [...withHltb, ...fallback].slice(0, 3);
}

// ─── Verdict theme ────────────────────────────────────────────────────────────

const VERDICT_THEME: Record<VerdictLevel, {
  label: string; esLabel: string;
  emoji: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  border: string;
}> = {
  green: {
    label: 'GREEN LIGHT', esLabel: 'LUZ VERDE',
    emoji: '🟢', icon: 'checkmark-circle',
    color: '#4CAF7D', bg: '#081A0E', border: '#4CAF7D35',
  },
  yellow: {
    label: 'THINK TWICE', esLabel: 'PIÉNSALO',
    emoji: '⚠️', icon: 'warning',
    color: ED.amber, bg: '#1A1000', border: ED.amber + '35',
  },
  red: {
    label: 'TERRIBLE IDEA', esLabel: 'PÉSIMA IDEA',
    emoji: '💀', icon: 'skull',
    color: ED.rust, bg: '#1A0806', border: ED.rust + '35',
  },
  go: {
    label: 'BUY IT — COMMIT', esLabel: 'CÓMPRALO — COMPROMÉTETE',
    emoji: '❤️', icon: 'heart',
    color: ED.plum, bg: '#10061A', border: ED.plum + '35',
  },
};

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function PurchaseAdvisorScreen() {
  const { language, playerName = 'Player' } = useAppContext() as any;
  const router = useRouter();
  const verdictRef = useRef<ViewShot>(null);
  const [step, setStep] = useState<Step>('search');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ManualGameSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedGame, setSelectedGame] = useState<ManualGameSearchResult | null>(null);
  const [hltbHours, setHltbHours] = useState<number | null>(null);
  const [hltbLoading, setHltbLoading] = useState(false);
  const [motivation, setMotivation] = useState<Motivation | null>(null);
  const [timing, setTiming] = useState<Timing | null>(null);
  const [verdict, setVerdict] = useState<VerdictData | null>(null);
  const [sharing, setSharing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lang = language as Language;

  const handleQueryChange = (text: string) => {
    setQuery(text);
    setSelectedGame(null);
    setHltbHours(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) { setSearchResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try { setSearchResults((await searchGamesByTitle(text)).slice(0, 8)); }
      catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 400);
  };

  const handleSelectGame = useCallback(async (game: ManualGameSearchResult) => {
    setSelectedGame(game);
    setSearchResults([]);
    setQuery(game.title);
    setHltbLoading(true);
    try {
      const res = await searchHLTB(game.title);
      setHltbHours(res.status === 'success' && res.result ? Math.round(res.result.comp_main / 3600) : null);
    } catch { setHltbHours(null); }
    finally { setHltbLoading(false); }
  }, []);

  const handleAnalyze = async () => {
    if (!selectedGame || !motivation || !timing) return;
    setStep('analyzing');
    await new Promise((r) => setTimeout(r, 1400));
    const stats = getBacklogStats();
    const allGames = getAllGames();
    const backlogHoursBefore = stats.total_hours_remaining;
    const gameHoursNum = hltbHours ?? 15;
    const backlogHoursAfter = backlogHoursBefore + gameHoursNum;
    const hoursPerYear = 2 * 365;
    const level = computeVerdict(motivation, timing, backlogHoursBefore);
    setVerdict({
      level,
      gameTitle: selectedGame.title,
      gameCover: selectedGame.coverUrl,
      gameHours: hltbHours,
      totalGames: stats.total,
      backlogHoursBefore,
      backlogHoursAfter,
      finishYearBefore: new Date().getFullYear() + Math.ceil(backlogHoursBefore / hoursPerYear),
      finishYearAfter: new Date().getFullYear() + Math.ceil(backlogHoursAfter / hoursPerYear),
      similarGames: findSimilarGames(selectedGame, allGames),
      playerName: playerName as string,
    });
    setStep('verdict');
    trackEvent('purchase_advisor_used', {});
  };

  const handleShare = async () => {
    if (!verdictRef.current?.capture) return;
    setSharing(true);
    try {
      const uri = await verdictRef.current.capture();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { dialogTitle: 'BacklogFlow Verdict', mimeType: 'image/png' });
      } else {
        Alert.alert(t('share_err_unavail', lang), t('share_err_unavail_msg', lang));
      }
    } catch {
      Alert.alert(t('share_err_fail', lang), t('share_err_fail_msg', lang));
    } finally {
      setSharing(false);
    }
  };

  const handleReset = () => {
    setStep('search');
    setQuery('');
    setSearchResults([]);
    setSelectedGame(null);
    setHltbHours(null);
    setMotivation(null);
    setTiming(null);
    setVerdict(null);
  };

  const motivationOptions: { key: Motivation; label: string; emoji: string; special?: boolean }[] = [
    { key: 'everyone', label: t('pa_mot_everyone', lang), emoji: '🌐' },
    { key: 'sale', label: t('pa_mot_sale', lang), emoji: '🏷️' },
    { key: 'interested', label: t('pa_mot_interested', lang), emoji: '🎯', special: true },
    { key: 'fomo', label: t('pa_mot_fomo', lang), emoji: '😰' },
    { key: 'curious', label: t('pa_mot_curious', lang), emoji: '🤔' },
    { key: 'waiting', label: t('pa_mot_waiting', lang), emoji: '⏳', special: true },
  ];

  const timingOptions: { key: Timing; label: string; emoji: string }[] = [
    { key: 'now', label: t('pa_tim_now', lang), emoji: '⚡' },
    { key: 'soon', label: t('pa_tim_soon', lang), emoji: '📅' },
    { key: 'eventually', label: t('pa_tim_eventually', lang), emoji: '🕓' },
    { key: 'never', label: t('pa_tim_never', lang), emoji: '💀' },
  ];

  const canAnalyze = selectedGame && !hltbLoading && motivation && timing;

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={22} color={ED.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={edStyles.eyebrow}>PURCHASE ADVISOR</Text>
          <Text style={s.headerTitle}>{t('pa_title', lang)}</Text>
        </View>
        <View style={s.aiBadge}>
          <Ionicons name="analytics" size={12} color={ED.plum} />
          <Text style={s.aiBadgeText}>AI</Text>
        </View>
      </View>

      {/* ── STEP: Search + Questions ── */}
      {step === 'search' && (
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Step 01: Game */}
          <View style={s.stepCard}>
            <View style={s.stepNumRow}>
              <Text style={s.stepNum}>01</Text>
              <Text style={s.stepLabel}>{t('pa_search_placeholder', lang)}</Text>
            </View>
            <View style={s.searchBar}>
              <Ionicons name="search" size={15} color={searching ? ED.copper : ED.ink3} />
              <TextInput
                style={s.searchInput}
                placeholder={t('pa_search_hint', lang)}
                placeholderTextColor={ED.ink4}
                value={query}
                onChangeText={handleQueryChange}
                autoCorrect={false}
              />
              {(searching || hltbLoading) && <ActivityIndicator size="small" color={ED.copper} />}
              {query.length > 0 && !searching && !hltbLoading && (
                <TouchableOpacity onPress={() => { setQuery(''); setSelectedGame(null); setSearchResults([]); }}>
                  <Ionicons name="close-circle" size={15} color={ED.ink3} />
                </TouchableOpacity>
              )}
            </View>

            {searchResults.length > 0 && (
              <View style={s.dropdown}>
                {searchResults.map((item, idx) => (
                  <TouchableOpacity
                    key={item.igdbId}
                    style={[s.dropdownItem, idx < searchResults.length - 1 && { borderBottomWidth: 1, borderBottomColor: ED.line }]}
                    onPress={() => handleSelectGame(item)}
                    activeOpacity={0.8}
                  >
                    <GameCover uri={item.coverUrl ?? ''} width={34} height={34} radius={6} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.dropdownTitle} numberOfLines={1}>{item.title}</Text>
                      {item.releaseYear ? <Text style={s.dropdownMeta}>{item.releaseYear}</Text> : null}
                    </View>
                    <Ionicons name="chevron-forward" size={12} color={ED.ink3} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {selectedGame && (
              <View style={s.selectedCard}>
                <GameCover uri={selectedGame.coverUrl ?? ''} width={48} height={48} radius={8} />
                <View style={{ flex: 1 }}>
                  <Text style={s.selectedTitle} numberOfLines={2}>{selectedGame.title}</Text>
                  {hltbLoading ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <ActivityIndicator size="small" color={ED.sky} />
                      <Text style={s.hltbText}>Looking up HLTB…</Text>
                    </View>
                  ) : hltbHours !== null ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <Ionicons name="time-outline" size={11} color={ED.sky} />
                      <Text style={[s.hltbText, { color: ED.sky, fontWeight: '700' }]}>~{hltbHours}h to beat</Text>
                    </View>
                  ) : (
                    <Text style={[s.hltbText, { marginTop: 4 }]}>No HLTB data</Text>
                  )}
                </View>
                <View style={s.checkBadge}>
                  <Ionicons name="checkmark" size={12} color="#1A1108" />
                </View>
              </View>
            )}
          </View>

          {/* Step 02: Motivation */}
          {selectedGame && !hltbLoading && (
            <View style={s.stepCard}>
              <View style={s.stepNumRow}>
                <Text style={s.stepNum}>02</Text>
                <Text style={s.stepLabel}>{t('pa_q_motivation', lang)}</Text>
              </View>
              <View style={s.optionGrid}>
                {motivationOptions.map((opt) => {
                  const active = motivation === opt.key;
                  const color = opt.special ? ED.plum : ED.copper;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[s.optChip, active && { borderColor: color, backgroundColor: color + '18' }]}
                      onPress={() => setMotivation(opt.key)}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 14 }}>{opt.emoji}</Text>
                      <Text style={[s.optText, active && { color }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Step 03: Timing */}
          {selectedGame && !hltbLoading && (
            <View style={s.stepCard}>
              <View style={s.stepNumRow}>
                <Text style={s.stepNum}>03</Text>
                <Text style={s.stepLabel}>{t('pa_q_timing', lang)}</Text>
              </View>
              <View style={s.optionGrid}>
                {timingOptions.map((opt) => {
                  const active = timing === opt.key;
                  const color = opt.key === 'never' ? ED.rust : ED.sky;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[s.optChip, active && { borderColor: color, backgroundColor: color + '18' }]}
                      onPress={() => setTiming(opt.key)}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 14 }}>{opt.emoji}</Text>
                      <Text style={[s.optText, active && { color }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Analyze button */}
          {selectedGame && !hltbLoading && (
            <TouchableOpacity
              style={[s.analyzeBtn, !canAnalyze && { opacity: 0.35 }]}
              onPress={handleAnalyze}
              disabled={!canAnalyze}
              activeOpacity={0.85}
            >
              <Ionicons name="analytics" size={18} color="#1A1108" />
              <Text style={s.analyzeBtnText}>{t('pa_analyze_btn', lang)}</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* ── STEP: Analyzing ── */}
      {step === 'analyzing' && (
        <View style={s.analyzingWrap}>
          <View style={s.analyzingInner}>
            <View style={s.analyzingIcon}>
              <Ionicons name="analytics" size={32} color={ED.plum} />
            </View>
            <ActivityIndicator size="large" color={ED.copper} style={{ marginTop: 24 }} />
            <Text style={s.analyzingTitle}>{t('pa_analyzing', lang)}</Text>
            {selectedGame && (
              <Text style={s.analyzingGame} numberOfLines={1}>{selectedGame.title}</Text>
            )}
          </View>
        </View>
      )}

      {/* ── STEP: Verdict ── */}
      {step === 'verdict' && verdict && (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <VerdictDisplay verdict={verdict} lang={lang} verdictRef={verdictRef} />

          <TouchableOpacity
            style={[s.analyzeBtn, { backgroundColor: VERDICT_THEME[verdict.level].color, borderColor: VERDICT_THEME[verdict.level].color, marginTop: 16 }]}
            onPress={handleShare}
            activeOpacity={0.85}
          >
            {sharing ? (
              <ActivityIndicator size="small" color="#1A1108" />
            ) : (
              <>
                <Ionicons name="share-social" size={16} color="#1A1108" />
                <Text style={s.analyzeBtnText}>{t('pa_share_verdict', lang)}</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={s.resetBtn} onPress={handleReset} activeOpacity={0.8}>
            <Ionicons name="refresh" size={14} color={ED.ink3} />
            <Text style={s.resetBtnText}>{t('pa_try_again', lang)}</Text>
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </View>
  );
}

// ─── Verdict Display ──────────────────────────────────────────────────────────

function VerdictDisplay({ verdict, lang, verdictRef }: {
  verdict: VerdictData;
  lang: Language;
  verdictRef: React.RefObject<ViewShot>;
}) {
  const theme = VERDICT_THEME[verdict.level];
  const yearDelta = verdict.finishYearAfter - verdict.finishYearBefore;

  return (
    <>
      {/* Capturable share card */}
      <ViewShot ref={verdictRef} options={{ format: 'png', quality: 0.97 }}>
        <View style={[sc.card, { backgroundColor: theme.bg, borderColor: theme.border }]}>
          {/* Header */}
          <View style={sc.cardHeader}>
            <View style={[sc.logoBox, { borderColor: theme.color + '50' }]}>
              <Ionicons name="game-controller" size={14} color={theme.color} />
            </View>
            <Text style={[sc.logoText, { color: theme.color }]}>BacklogFlow</Text>
            <Text style={[sc.featureTag, { color: theme.color + 'AA' }]}>Reality Check</Text>
          </View>

          {/* Verdict badge */}
          <View style={[sc.verdictBadge, { backgroundColor: theme.color + '18', borderColor: theme.color + '60' }]}>
            <Text style={{ fontSize: 20 }}>{theme.emoji}</Text>
            <Text style={[sc.verdictLabel, { color: theme.color }]}>
              {lang === 'es' ? theme.esLabel : theme.label}
            </Text>
          </View>

          {/* Game title */}
          <Text style={sc.gameTitle} numberOfLines={2}>{verdict.gameTitle}</Text>
          {verdict.gameHours !== null && (
            <Text style={[sc.gameHours, { color: theme.color }]}>~{verdict.gameHours}h to beat</Text>
          )}

          {/* Divider */}
          <View style={[sc.divider, { backgroundColor: theme.color + '30' }]} />

          {/* Stats row */}
          <View style={sc.statsRow}>
            {[
              { val: String(verdict.totalGames), lbl: 'games' },
              { val: `${verdict.backlogHoursBefore}h`, lbl: 'backlog' },
              { val: String(verdict.finishYearBefore), lbl: 'finish yr', color: theme.color },
            ].map(({ val, lbl, color }, i, arr) => (
              <React.Fragment key={lbl}>
                {i > 0 && <View style={[sc.statDivider, { backgroundColor: theme.color + '30' }]} />}
                <View style={sc.statBlock}>
                  <Text style={[sc.statNum, color ? { color } : {}]}>{val}</Text>
                  <Text style={sc.statLbl}>{lbl}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>

          {/* Year comparison */}
          <View style={[sc.yearBox, { borderColor: theme.color + '30', backgroundColor: theme.color + '0A' }]}>
            <View style={{ alignItems: 'center' }}>
              <Text style={sc.yearBoxLabel}>{t('pa_finish_before', lang)}</Text>
              <Text style={sc.yearNum}>{verdict.finishYearBefore}</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={[sc.yearArrow, { color: theme.color }]}>→</Text>
              {yearDelta > 0 && <Text style={[sc.yearDelta, { color: theme.color }]}>+{yearDelta}yr</Text>}
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={sc.yearBoxLabel}>{t('pa_finish_after', lang)}</Text>
              <Text style={[sc.yearNum, { color: theme.color }]}>{verdict.finishYearAfter}</Text>
            </View>
          </View>

          {/* Verdict description */}
          <View style={[sc.descBox, { borderLeftColor: theme.color, backgroundColor: theme.color + '0A' }]}>
            <Text style={sc.descText}>{t(('pa_desc_' + verdict.level) as StringKey, lang)}</Text>
          </View>

          <Text style={sc.cardFooter}>BacklogFlow · backlogflow.app</Text>
        </View>
      </ViewShot>

      {/* Similar games (not captured) */}
      {verdict.similarGames.length > 0 && (
        <View style={[edStyles.card, { marginTop: 16 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderBottomWidth: 1, borderBottomColor: ED.line }}>
            <Ionicons name="layers" size={14} color={ED.copper} />
            <Text style={[edStyles.eyebrow, { color: ED.copper }]}>{t('pa_similar_desc', lang)}</Text>
          </View>
          {verdict.similarGames.map((g, idx) => (
            <View
              key={g.id}
              style={[
                { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
                idx < verdict.similarGames.length - 1 && { borderBottomWidth: 1, borderBottomColor: ED.line },
              ]}
            >
              <GameCover uri={g.cover_url} width={40} height={40} radius={8} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: ED.ink }} numberOfLines={1}>{g.title}</Text>
                {g.hltb_main_story !== null && (
                  <Text style={{ fontSize: 11, color: ED.ink3, marginTop: 2 }}>
                    ~{Math.round(g.hltb_main_story / 3600)}h
                  </Text>
                )}
              </View>
              <View style={[edStyles.pill]}>
                <Text style={edStyles.pillText}>{g.status.replace('_', ' ')}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: ED.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingHorizontal: 20, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: ED.line,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: ED.surface2, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.6, color: ED.ink, marginTop: 2 },
  aiBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: ED.plum + '50',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: ED.plumBg,
  },
  aiBadgeText: {
    fontFamily: MONO_FONT, fontSize: 10, fontWeight: '700', color: ED.plum, letterSpacing: 0.8,
  },

  scroll: { paddingHorizontal: 16, paddingTop: 16 },

  stepCard: {
    borderRadius: 14, borderWidth: 1, borderColor: ED.line,
    backgroundColor: ED.surface1, padding: 16, marginBottom: 14,
  },
  stepNumRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  stepNum: {
    fontFamily: MONO_FONT, fontSize: 11, fontWeight: '700',
    color: ED.plum, marginRight: 10, letterSpacing: 1,
  },
  stepLabel: { fontSize: 14, fontWeight: '700', color: ED.ink },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: ED.copperLine, borderRadius: 12,
    backgroundColor: ED.copperBg, paddingHorizontal: 12, height: 46,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500', color: ED.ink },

  dropdown: {
    borderRadius: 12, borderWidth: 1, borderColor: ED.line,
    backgroundColor: ED.surface2, marginTop: 8, overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12,
  },
  dropdownTitle: { fontSize: 13, fontWeight: '600', color: ED.ink },
  dropdownMeta: { fontSize: 11, color: ED.ink3, marginTop: 1 },

  selectedCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 12, borderRadius: 12, borderWidth: 1,
    borderColor: ED.copperLine, backgroundColor: ED.copperBg, padding: 12,
  },
  selectedTitle: { fontSize: 14, fontWeight: '700', color: ED.ink },
  hltbText: { fontSize: 11, color: ED.ink3 },
  checkBadge: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: ED.copper, alignItems: 'center', justifyContent: 'center',
  },

  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 100, borderWidth: 1, borderColor: ED.line,
    backgroundColor: ED.surface2,
  },
  optText: { fontSize: 12, fontWeight: '600', color: ED.ink2 },

  analyzeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 52, borderRadius: 14, borderWidth: 1,
    backgroundColor: ED.copper, borderColor: ED.copper,
  },
  analyzeBtnText: { fontSize: 15, fontWeight: '800', color: '#1A1108' },

  analyzingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  analyzingInner: { alignItems: 'center' },
  analyzingIcon: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: ED.plumBg, borderWidth: 1, borderColor: ED.plum + '40',
    alignItems: 'center', justifyContent: 'center',
  },
  analyzingTitle: { fontFamily: MONO_FONT, fontSize: 13, color: ED.copper, marginTop: 16, letterSpacing: 1.2 },
  analyzingGame: { fontSize: 14, color: ED.ink3, marginTop: 6, maxWidth: 260, textAlign: 'center' },

  resetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: ED.line, borderRadius: 12,
    paddingVertical: 14, marginTop: 12, backgroundColor: ED.surface1,
  },
  resetBtnText: { fontSize: 13, fontWeight: '600', color: ED.ink3 },
});

// ─── Share card styles ────────────────────────────────────────────────────────

const sc = StyleSheet.create({
  card: {
    width: SCREEN_W - 32, borderRadius: 20, borderWidth: 1,
    overflow: 'hidden', padding: 22,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  logoBox: {
    width: 26, height: 26, borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  logoText: { fontSize: 13, fontWeight: '800', letterSpacing: -0.3, flex: 1 },
  featureTag: {
    fontFamily: MONO_FONT, fontSize: 9, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1.2,
  },
  verdictBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    alignSelf: 'flex-start', borderRadius: 12, borderWidth: 1.5,
    paddingHorizontal: 14, paddingVertical: 9, marginBottom: 16,
  },
  verdictLabel: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  gameTitle: {
    fontSize: 26, fontWeight: '900', color: '#F0E8DE',
    letterSpacing: -0.8, lineHeight: 30, marginBottom: 6,
  },
  gameHours: { fontSize: 12, fontWeight: '700', marginBottom: 18 },
  divider: { height: 1, marginVertical: 18 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  statBlock: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '900', color: '#F0E8DE', letterSpacing: -0.5 },
  statLbl: {
    fontFamily: MONO_FONT, fontSize: 9, color: 'rgba(240,232,222,0.4)',
    fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2,
  },
  statDivider: { width: 1, height: 30 },
  yearBox: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    borderWidth: 1, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 12,
    marginBottom: 14,
  },
  yearBoxLabel: {
    fontFamily: MONO_FONT, fontSize: 9, color: 'rgba(240,232,222,0.4)',
    letterSpacing: 0.5, marginBottom: 4,
  },
  yearNum: { fontSize: 24, fontWeight: '900', color: '#F0E8DE', letterSpacing: -0.5 },
  yearArrow: { fontSize: 22, fontWeight: '900' },
  yearDelta: { fontFamily: MONO_FONT, fontSize: 10, fontWeight: '700', marginTop: 2 },
  descBox: {
    borderLeftWidth: 3, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 18,
  },
  descText: { fontSize: 13, lineHeight: 20, fontWeight: '600', color: 'rgba(240,232,222,0.85)' },
  cardFooter: {
    fontFamily: MONO_FONT, fontSize: 9, color: 'rgba(240,232,222,0.2)',
    textAlign: 'center', fontWeight: '600', letterSpacing: 0.5,
  },
});
