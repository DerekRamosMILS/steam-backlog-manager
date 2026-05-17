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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { GlassCard } from '../components/GlassCard';
import { GameCover } from '../components/GameCover';
import { useAppContext } from '../hooks/useAppContext';
import { t, Language, StringKey } from '../i18n';
import { trackEvent } from '../services/analyticsService';
import { searchGamesByTitle } from '../services/gameSearchService';
import { searchHLTB } from '../api/hltb';
import { getBacklogStats, getAllGames } from '../database/queries';
import { ManualGameSearchResult, Game } from '../types';

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
  bg: string[];
  glow: string;
}> = {
  green: {
    label: 'GREEN LIGHT', esLabel: 'LUZ VERDE',
    emoji: '🟢', icon: 'checkmark-circle',
    color: '#22c55e', bg: ['#001a08', '#003014'], glow: '#22c55e44',
  },
  yellow: {
    label: 'THINK TWICE', esLabel: 'PIÉNSALO',
    emoji: '⚠️', icon: 'warning',
    color: '#f59e0b', bg: ['#1a1000', '#2e1c00'], glow: '#f59e0b44',
  },
  red: {
    label: 'TERRIBLE IDEA', esLabel: 'PÉSIMA IDEA',
    emoji: '💀', icon: 'skull',
    color: '#ef4444', bg: ['#1a0000', '#2d0505'], glow: '#ef444455',
  },
  go: {
    label: 'BUY IT — COMMIT', esLabel: 'CÓMPRALO — COMPROMÉTETE',
    emoji: '❤️', icon: 'heart',
    color: '#a855f7', bg: ['#0d0020', '#1a003a'], glow: '#a855f755',
  },
};

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function PurchaseAdvisorScreen() {
  const { themeColors, language, playerName = 'Player' } = useAppContext() as any;
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
    {
    }
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
    } catch (e) {
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

  const lang = language as Language;

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
    <View style={[styles.root, { backgroundColor: themeColors.bg }]}>
      <LinearGradient colors={[themeColors.bg, themeColors.card]} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={themeColors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>{t('pa_title', lang)}</Text>
          <Text style={[styles.subtitle, { color: themeColors.textMuted }]}>{t('pa_subtitle', lang)}</Text>
        </View>
        <View style={[styles.headerBadge, { backgroundColor: '#a855f722', borderColor: '#a855f755' }]}>
          <Ionicons name="analytics" size={14} color="#a855f7" />
          <Text style={{ fontSize: 10, color: '#a855f7', fontWeight: '800' }}>AI</Text>
        </View>
      </View>

      {/* ── STEP: Search + Questions ── */}
      {step === 'search' && (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Search card */}
          <GlassCard padding={16} style={{ marginBottom: 16 }}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.stepNum}>01</Text>
              <Text style={[styles.cardTitle, { color: themeColors.textPrimary }]}>
                {t('pa_search_placeholder', lang)}
              </Text>
            </View>

            <View style={[styles.searchWrap, { borderColor: themeColors.glassBorder, backgroundColor: themeColors.glass }]}>
              <Ionicons name="search" size={16} color={themeColors.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: themeColors.textPrimary }]}
                placeholder={t('pa_search_hint', lang)}
                placeholderTextColor={themeColors.textMuted}
                value={query}
                onChangeText={handleQueryChange}
                autoCorrect={false}
              />
              {(searching || hltbLoading) && <ActivityIndicator size="small" color={themeColors.accent} />}
              {query.length > 0 && !searching && !hltbLoading && (
                <TouchableOpacity onPress={() => { setQuery(''); setSelectedGame(null); setSearchResults([]); }}>
                  <Ionicons name="close-circle" size={16} color={themeColors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {searchResults.length > 0 && (
              <View style={[styles.dropdown, { backgroundColor: themeColors.card, borderColor: themeColors.glassBorder }]}>
                {searchResults.map((item) => (
                  <TouchableOpacity
                    key={item.igdbId}
                    style={[styles.dropdownItem, { borderBottomColor: themeColors.glassBorder }]}
                    onPress={() => handleSelectGame(item)}
                  >
                    <GameCover uri={item.coverUrl ?? ''} width={36} height={36} radius={8} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.dropdownTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>{item.title}</Text>
                      {item.releaseYear && <Text style={{ fontSize: 11, color: themeColors.textMuted }}>{item.releaseYear}</Text>}
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={themeColors.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {selectedGame && (
              <View style={[styles.selectedCard, { backgroundColor: themeColors.accent + '18', borderColor: themeColors.accent + '55' }]}>
                <GameCover uri={selectedGame.coverUrl ?? ''} width={52} height={52} radius={10} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.selectedTitle, { color: themeColors.textPrimary }]} numberOfLines={2}>{selectedGame.title}</Text>
                  {hltbLoading ? (
                    <View style={styles.hltbRow}>
                      <ActivityIndicator size="small" color={themeColors.teal} />
                      <Text style={{ fontSize: 11, color: themeColors.textMuted, marginLeft: 4 }}>Looking up HLTB…</Text>
                    </View>
                  ) : hltbHours !== null ? (
                    <View style={styles.hltbRow}>
                      <Ionicons name="time" size={12} color={themeColors.teal} />
                      <Text style={{ fontSize: 12, color: themeColors.teal, fontWeight: '700', marginLeft: 4 }}>~{hltbHours}h to beat</Text>
                    </View>
                  ) : (
                    <Text style={{ fontSize: 11, color: themeColors.textMuted }}>No HLTB data found</Text>
                  )}
                </View>
                <View style={[styles.checkBadge, { backgroundColor: themeColors.accent }]}>
                  <Ionicons name="checkmark" size={14} color="#fff" />
                </View>
              </View>
            )}
          </GlassCard>

          {/* Motivation card */}
          {selectedGame && !hltbLoading && (
            <GlassCard padding={16} style={{ marginBottom: 16 }}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.stepNum}>02</Text>
                <Text style={[styles.cardTitle, { color: themeColors.textPrimary }]}>{t('pa_q_motivation', lang)}</Text>
              </View>
              <View style={styles.optionGrid}>
                {motivationOptions.map((opt) => {
                  const active = motivation === opt.key;
                  const color = opt.special ? '#a855f7' : themeColors.accent;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.optionChip, { borderColor: active ? color : themeColors.glassBorder, backgroundColor: active ? color + '28' : themeColors.glass }]}
                      onPress={() => setMotivation(opt.key)}
                    >
                      <Text style={styles.optionEmoji}>{opt.emoji}</Text>
                      <Text style={[styles.optionText, { color: active ? color : themeColors.textSecondary }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </GlassCard>
          )}

          {/* Timing card */}
          {selectedGame && !hltbLoading && (
            <GlassCard padding={16} style={{ marginBottom: 20 }}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.stepNum}>03</Text>
                <Text style={[styles.cardTitle, { color: themeColors.textPrimary }]}>{t('pa_q_timing', lang)}</Text>
              </View>
              <View style={styles.optionGrid}>
                {timingOptions.map((opt) => {
                  const active = timing === opt.key;
                  const danger = opt.key === 'never';
                  const color = danger ? themeColors.red : themeColors.teal;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.optionChip, { borderColor: active ? color : themeColors.glassBorder, backgroundColor: active ? color + '28' : themeColors.glass }]}
                      onPress={() => setTiming(opt.key)}
                    >
                      <Text style={styles.optionEmoji}>{opt.emoji}</Text>
                      <Text style={[styles.optionText, { color: active ? color : themeColors.textSecondary }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </GlassCard>
          )}

          {/* Analyze button */}
          {selectedGame && !hltbLoading && (
            <TouchableOpacity
              style={[styles.analyzeBtn, { opacity: canAnalyze ? 1 : 0.35 }]}
              onPress={handleAnalyze}
              disabled={!canAnalyze}
              activeOpacity={0.85}
            >
              <LinearGradient colors={['#a855f7', '#7c3aed']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
              <Ionicons name="analytics" size={20} color="#fff" />
              <Text style={styles.analyzeBtnText}>{t('pa_analyze_btn', lang)}</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* ── STEP: Analyzing ── */}
      {step === 'analyzing' && (
        <View style={styles.analyzingWrap}>
          <LinearGradient colors={['#0d0020', '#1a003a']} style={StyleSheet.absoluteFill} />
          <View style={styles.analyzingInner}>
            <Ionicons name="analytics" size={56} color="#a855f7" />
            <ActivityIndicator size="large" color="#a855f7" style={{ marginTop: 20 }} />
            <Text style={styles.analyzingTitle}>{t('pa_analyzing', lang)}</Text>
            {selectedGame && (
              <Text style={styles.analyzingGame} numberOfLines={1}>{selectedGame.title}</Text>
            )}
          </View>
        </View>
      )}

      {/* ── STEP: Verdict ── */}
      {step === 'verdict' && verdict && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <VerdictDisplay
            verdict={verdict}
            lang={lang}
            themeColors={themeColors}
            verdictRef={verdictRef}
          />

          {/* Share button */}
          <TouchableOpacity
            style={[styles.shareBtn, { backgroundColor: VERDICT_THEME[verdict.level].color }]}
            onPress={handleShare}
            activeOpacity={0.85}
          >
            {sharing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="share-social" size={20} color="#fff" />
                <Text style={styles.shareBtnText}>{t('pa_share_verdict', lang)}</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Try again */}
          <TouchableOpacity style={[styles.resetBtn, { borderColor: themeColors.glassBorder }]} onPress={handleReset}>
            <Ionicons name="refresh" size={16} color={themeColors.textMuted} />
            <Text style={[styles.resetBtnText, { color: themeColors.textMuted }]}>{t('pa_try_again', lang)}</Text>
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

    </View>
  );
}

// ─── Verdict Display ──────────────────────────────────────────────────────────

function VerdictDisplay({ verdict, lang, themeColors, verdictRef }: {
  verdict: VerdictData;
  lang: Language;
  themeColors: any;
  verdictRef: React.RefObject<ViewShot>;
}) {
  const theme = VERDICT_THEME[verdict.level];
  const yearDelta = verdict.finishYearAfter - verdict.finishYearBefore;

  return (
    <>
      {/* ─ Capturable share card ─ */}
      <ViewShot ref={verdictRef} options={{ format: 'png', quality: 0.97 }}>
        <View style={[shareStyles.card, { backgroundColor: theme.bg[1] }]}>
          <LinearGradient colors={theme.bg as [string, string, ...string[]]} style={StyleSheet.absoluteFill} />

          {/* Glow overlay */}
          <View style={[shareStyles.glowCircle, { backgroundColor: theme.glow }]} />

          {/* BacklogFlow header */}
          <View style={shareStyles.cardHeader}>
            <View style={[shareStyles.logoBox, { backgroundColor: theme.color + '22', borderColor: theme.color + '55' }]}>
              <Ionicons name="game-controller" size={16} color={theme.color} />
            </View>
            <Text style={[shareStyles.logoText, { color: theme.color }]}>BacklogFlow</Text>
            <Text style={[shareStyles.featureTag, { color: theme.color + 'aa' }]}>Reality Check</Text>
          </View>

          {/* Verdict badge */}
          <View style={shareStyles.verdictBadgeWrap}>
            <View style={[shareStyles.verdictBadge, { backgroundColor: theme.color + '22', borderColor: theme.color + '77' }]}>
              <Text style={shareStyles.verdictEmoji}>{theme.emoji}</Text>
              <Text style={[shareStyles.verdictLabel, { color: theme.color }]}>
                {lang === 'es' ? theme.esLabel : theme.label}
              </Text>
            </View>
          </View>

          {/* Game title */}
          <Text style={shareStyles.gameTitle} numberOfLines={2}>{verdict.gameTitle}</Text>
          {verdict.gameHours !== null && (
            <Text style={[shareStyles.gameHours, { color: theme.color }]}>~{verdict.gameHours}h to beat</Text>
          )}

          {/* Divider */}
          <View style={[shareStyles.divider, { backgroundColor: theme.color + '33' }]} />

          {/* Stats */}
          <View style={shareStyles.statsRow}>
            <View style={shareStyles.statBlock}>
              <Text style={[shareStyles.statNum, { color: '#fff' }]}>{verdict.totalGames}</Text>
              <Text style={shareStyles.statLbl}>games</Text>
            </View>
            <View style={[shareStyles.statDivider, { backgroundColor: theme.color + '44' }]} />
            <View style={shareStyles.statBlock}>
              <Text style={[shareStyles.statNum, { color: '#fff' }]}>{verdict.backlogHoursBefore}h</Text>
              <Text style={shareStyles.statLbl}>backlog</Text>
            </View>
            <View style={[shareStyles.statDivider, { backgroundColor: theme.color + '44' }]} />
            <View style={shareStyles.statBlock}>
              <Text style={[shareStyles.statNum, { color: theme.color }]}>{verdict.finishYearBefore}</Text>
              <Text style={shareStyles.statLbl}>finish year</Text>
            </View>
          </View>

          {/* Year comparison */}
          <View style={[shareStyles.yearCompare, { borderColor: theme.color + '33', backgroundColor: theme.color + '0d' }]}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 11, color: '#ffffff66', marginBottom: 2 }}>
                {t('pa_finish_before', lang)}
              </Text>
              <Text style={{ fontSize: 26, fontWeight: '900', color: '#fff' }}>{verdict.finishYearBefore}</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={[shareStyles.arrowText, { color: theme.color }]}>→</Text>
              {yearDelta > 0 && (
                <Text style={{ fontSize: 11, color: theme.color, fontWeight: '700' }}>+{yearDelta}yr</Text>
              )}
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 11, color: '#ffffff66', marginBottom: 2 }}>
                {t('pa_finish_after', lang)}
              </Text>
              <Text style={{ fontSize: 26, fontWeight: '900', color: theme.color }}>{verdict.finishYearAfter}</Text>
            </View>
          </View>

          {/* Verdict description */}
          <View style={[shareStyles.descBox, { borderLeftColor: theme.color, backgroundColor: theme.color + '0d' }]}>
            <Text style={[shareStyles.descText, { color: verdict.level === 'red' || verdict.level === 'go' ? '#fff' : '#ffffffcc' }]}>
              {t(('pa_desc_' + verdict.level) as StringKey, lang)}
            </Text>
          </View>

          {/* Footer */}
          <Text style={shareStyles.cardFooter}>BacklogFlow · backlogflow.app</Text>
        </View>
      </ViewShot>

      {/* ─ Similar games (below share card, not captured) ─ */}
      {verdict.similarGames.length > 0 && (
        <GlassCard padding={16} style={{ marginTop: 16 }}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="layers" size={16} color={themeColors.accent} />
            <Text style={[styles.cardTitle, { color: themeColors.textPrimary, marginLeft: 6 }]}>
              {t('pa_similar_desc', lang)}
            </Text>
          </View>
          {verdict.similarGames.map((g) => (
            <View key={g.id} style={[styles.similarRow, { borderBottomColor: themeColors.glassBorder }]}>
              <GameCover uri={g.cover_url} width={44} height={44} radius={8} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.similarTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>{g.title}</Text>
                {g.hltb_main_story !== null && (
                  <Text style={{ fontSize: 11, color: themeColors.textMuted }}>⏱ ~{Math.round(g.hltb_main_story / 3600)}h</Text>
                )}
              </View>
              <View style={[styles.statusPill, { backgroundColor: themeColors.accent + '22', borderColor: themeColors.accent + '55' }]}>
                <Text style={{ fontSize: 9, color: themeColors.accent, fontWeight: '800', textTransform: 'uppercase' }}>
                  {g.status.replace('_', ' ')}
                </Text>
              </View>
            </View>
          ))}
        </GlassCard>
      )}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingTop: 56, paddingHorizontal: 16, paddingBottom: 14,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { fontSize: 12, marginTop: 2 },
  headerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4,
  },
  scroll: { paddingHorizontal: 16, paddingTop: 4 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  stepNum: { fontSize: 11, fontWeight: '900', color: '#a855f7', marginRight: 8, letterSpacing: 1 },
  cardTitle: { fontSize: 14, fontWeight: '800' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 46,
  },
  searchInput: { flex: 1, fontSize: 14 },
  dropdown: {
    borderRadius: 12, borderWidth: 1, marginTop: 8, overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 10, borderBottomWidth: 1,
  },
  dropdownTitle: { fontSize: 13, fontWeight: '600' },
  selectedCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 12, borderRadius: 14, borderWidth: 1, padding: 12,
  },
  selectedTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  hltbRow: { flexDirection: 'row', alignItems: 'center' },
  checkBadge: {
    width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 20, borderWidth: 1,
  },
  optionEmoji: { fontSize: 14 },
  optionText: { fontSize: 12, fontWeight: '700' },
  analyzeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    height: 54, borderRadius: 16, overflow: 'hidden',
  },
  analyzeBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  analyzingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  analyzingInner: { alignItems: 'center' },
  analyzingTitle: { color: '#a855f7', fontSize: 16, fontWeight: '700', marginTop: 16 },
  analyzingGame: { color: '#ffffff88', fontSize: 13, marginTop: 6, maxWidth: 260, textAlign: 'center' },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    height: 54, borderRadius: 16, marginTop: 16,
  },
  shareBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  resetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 12,
  },
  resetBtnText: { fontSize: 14, fontWeight: '600' },
  similarRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1,
  },
  similarTitle: { fontSize: 13, fontWeight: '700' },
  statusPill: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1,
  },
});

// ─── Share card styles (fixed-width for screenshot) ───────────────────────────

const shareStyles = StyleSheet.create({
  card: {
    width: SCREEN_W - 32,
    borderRadius: 24,
    overflow: 'hidden',
    padding: 24,
    position: 'relative',
  },
  glowCircle: {
    position: 'absolute', width: 260, height: 260, borderRadius: 130,
    top: -80, right: -60, opacity: 0.4,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 22,
  },
  logoBox: {
    width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  logoText: { fontSize: 14, fontWeight: '900', letterSpacing: -0.3, flex: 1 },
  featureTag: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  verdictBadgeWrap: { marginBottom: 16 },
  verdictBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    alignSelf: 'flex-start', borderRadius: 14, borderWidth: 1.5,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  verdictEmoji: { fontSize: 22 },
  verdictLabel: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  gameTitle: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: -0.8, lineHeight: 34, marginBottom: 6 },
  gameHours: { fontSize: 13, fontWeight: '700', marginBottom: 20 },
  divider: { height: 1, width: '100%', marginVertical: 20 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  statBlock: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  statLbl: { fontSize: 10, color: '#ffffff55', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  statDivider: { width: 1, height: 36 },
  yearCompare: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    borderWidth: 1, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 12,
    marginBottom: 16,
  },
  arrowText: { fontSize: 24, fontWeight: '900' },
  descBox: {
    borderLeftWidth: 3, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 20,
  },
  descText: { fontSize: 13, lineHeight: 20, fontWeight: '600' },
  cardFooter: { fontSize: 11, color: '#ffffff33', textAlign: 'center', fontWeight: '600' },
});
