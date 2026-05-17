import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../src/hooks/useAppContext';
import { t, Language } from '../src/i18n';
import { useGames } from '../src/hooks/useGames';
import { BacklogStats, Game } from '../src/types';
import { getSetting } from '../src/database/queries';
import { ED, MONO_FONT } from '../src/styles/editorial';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMostPlayedGame(games: Game[]): Game | null {
  if (!games || games.length === 0) return null;
  const withPlaytime = games.filter((g) => g.playtime_minutes > 0);
  if (withPlaytime.length === 0) {
    const completed = games.find((g) => g.status === 'completed' && g.cover_url);
    if (completed) return completed;
    return games.find((g) => g.cover_url) ?? null;
  }
  return withPlaytime.reduce((best, g) => (g.playtime_minutes > best.playtime_minutes ? g : best));
}

function formatHours(minutes: number): string {
  return `${Math.round(minutes / 60)}h`;
}

// ─── Shame logic ──────────────────────────────────────────────────────────────

function computeShame(stats: BacklogStats): number {
  const backlog = stats.not_started + stats.up_next + stats.paused + stats.playing;
  let shame = stats.total > 0 ? Math.round((backlog / stats.total) * 100) : 0;
  if (stats.total > 100) shame = Math.min(100, shame + 15);
  else if (stats.total > 50) shame = Math.min(100, shame + 8);
  if (stats.total_hours_remaining > 500) shame = Math.min(100, shame + 10);
  else if (stats.total_hours_remaining > 200) shame = Math.min(100, shame + 5);
  return Math.max(5, Math.min(100, shame));
}

function getVerdict(shame: number, stats: BacklogStats, lang: Language): string {
  const finishYear = new Date().getFullYear() + Math.ceil(stats.total_hours_remaining / 365);

  const tiers: Array<{ min: number; en: string; es: string }> = [
    {
      min: 0,
      en: "You're suspiciously functional.\nAre you even a gamer?",
      es: 'Eres sospechosamente funcional.\n¿Seguro que juegas?',
    },
    {
      min: 15,
      en: 'A healthy backlog.\nA lie you tell yourself.',
      es: 'Un backlog saludable.\nUna mentira que te dices.',
    },
    {
      min: 30,
      en: 'Steam sales are not your friend.\nThey never were.',
      es: 'Las ofertas de Steam no son tus amigas.\nNunca lo fueron.',
    },
    {
      min: 45,
      en: 'The backlog grows.\nYou do not.',
      es: 'El backlog crece.\nTú, no.',
    },
    {
      min: 55,
      en: 'Certified digital hoarder.\nTherapy: $80/hr.\nA Steam sale: $4.99.',
      es: 'Acumulador digital certificado.\nTerapia: $80/hr.\nOferta de Steam: $4.99.',
    },
    {
      min: 65,
      en: "Your backlog is a\nsmall country's GDP.\nCongratulations?",
      es: 'Tu backlog equivale\nal PIB de un país pequeño.\n¿Felicidades?',
    },
    {
      min: 75,
      en: `You could finish your backlog\nin ${finishYear}. Start now.\nI mean it.`,
      es: `Podrías terminar tu backlog\nen ${finishYear}. Empieza ya.\nEn serio.`,
    },
    {
      min: 85,
      en: "Steam called.\nThey said 'stop'.",
      es: 'Steam llamó.\nDijo "ya basta".',
    },
    {
      min: 92,
      en: 'A therapist has been\nautomatically dispatched\nto your location.',
      es: 'Un terapeuta ha sido enviado\nautomáticamente\na tu ubicación.',
    },
  ];

  let verdict = tiers[0];
  for (const tier of tiers) {
    if (shame >= tier.min) verdict = tier;
  }
  return lang === 'es' ? verdict.es : verdict.en;
}

function shameBar(shame: number): string {
  const filled = Math.round(shame / 5);
  const empty = 20 - filled;
  return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, empty));
}

function getShameDegree(shame: number, lang: Language): string {
  if (shame < 20) return lang === 'es' ? 'BAJO CONTROL' : 'UNDER CONTROL';
  if (shame < 40) return lang === 'es' ? 'PREOCUPANTE' : 'CONCERNING';
  if (shame < 60) return lang === 'es' ? 'PROBLEMÁTICO' : 'PROBLEMATIC';
  if (shame < 80) return lang === 'es' ? 'CRÍTICO' : 'CRITICAL';
  return lang === 'es' ? 'CASO PERDIDO' : 'LOST CAUSE';
}

// ─── Library value helpers ────────────────────────────────────────────────────

function computeLibraryValue(games: Game[]) {
  const priced = games.filter((g) => g.price_cents && g.price_cents > 0);
  const totalCents = priced.reduce((s, g) => s + (g.price_cents ?? 0), 0);
  const avgCents = priced.length > 0 ? Math.round(totalCents / priced.length) : 0;
  const mostExp = priced.length > 0
    ? priced.reduce((best, g) => ((g.price_cents ?? 0) > (best.price_cents ?? 0) ? g : best))
    : null;
  return { priced, totalCents, avgCents, mostExp };
}

function formatCents(cents: number, currency: string): string {
  const amount = cents / 100;
  if (currency === 'mxn') return `$${Math.round(amount)} MXN`;
  return `$${amount.toFixed(2)} USD`;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ShareProfileScreen() {
  const { language = 'en', playerName = 'Player' } = useAppContext() as any;
  const lang = language as Language;
  const { games, stats, loading, refresh } = useGames();
  const profileRef = useRef<ViewShot>(null);
  const shameRef = useRef<ViewShot>(null);
  const libraryRef = useRef<ViewShot>(null);
  const [sharingProfile, setSharingProfile] = useState(false);
  const [sharingShame, setSharingShame] = useState(false);
  const [sharingLibrary, setSharingLibrary] = useState(false);
  const currency = getSetting('currency') ?? 'usd';

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  if (loading || !stats) {
    return (
      <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={ED.copper} />
      </View>
    );
  }

  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
  const mostPlayed = getMostPlayedGame(games);
  const shame = computeShame(stats);
  const verdict = getVerdict(shame, stats, lang);
  const bar = shameBar(shame);
  const degree = getShameDegree(shame, lang);
  const { priced, totalCents, avgCents, mostExp } = computeLibraryValue(games);
  const hoursPerUnit = totalCents > 0
    ? (stats.total_playtime_hours / (totalCents / 100)).toFixed(1)
    : null;

  const captureAndShare = async (
    ref: React.RefObject<ViewShot>,
    dialogTitle: string,
    onBusy: (v: boolean) => void,
  ) => {
    if (!ref.current?.capture) return;
    onBusy(true);
    try {
      const uri = await ref.current.capture();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { dialogTitle, mimeType: 'image/png' });
      } else {
        Alert.alert(t('share_err_unavail', lang), t('share_err_unavail_msg', lang));
      }
    } catch {
      Alert.alert(t('share_err_fail', lang), t('share_err_fail_msg', lang));
    } finally {
      onBusy(false);
    }
  };

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color={ED.ink} />
        </TouchableOpacity>
        <View>
          <Text style={s.headerEyebrow}>EXPORT</Text>
          <Text style={s.headerTitle}>{t('share_title', lang)}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Section: Gamer Profile ─────────────────────────────────── */}
        <View style={s.sectionHead}>
          <Text style={s.sectionEyebrow}>01 / GAMER PROFILE</Text>
        </View>

        <ViewShot ref={profileRef} options={{ format: 'png', quality: 0.95 }}>
          <View style={s.profileCard}>
            {/* Hero cover strip */}
            <View style={s.heroStrip}>
              {mostPlayed?.cover_url ? (
                <Image source={{ uri: mostPlayed.cover_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
              ) : null}
              <View style={s.heroOverlay} />
              {/* App label */}
              <View style={s.appLabel}>
                <Text style={s.appLabelText}>BACKLOGFLOW</Text>
              </View>
            </View>

            {/* Profile row */}
            <View style={s.profileRow}>
              <View style={s.avatar}>
                <Ionicons name="game-controller" size={22} color={ED.copper} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.playerName}>{playerName}</Text>
                <Text style={s.playerSub}>{t('share_total', lang)}: {stats.total} games</Text>
              </View>
              <View style={s.rateBadge}>
                <Text style={s.rateBadgeNum}>{completionRate}%</Text>
                <Text style={s.rateBadgeLbl}>WIN</Text>
              </View>
            </View>

            {/* Most played */}
            {mostPlayed && (
              <View style={s.spotlightRow}>
                <Text style={s.spotlightLabel}>{t('share_most_played', lang).toUpperCase()}</Text>
                <View style={s.spotlightInner}>
                  {mostPlayed.cover_url ? (
                    <Image source={{ uri: mostPlayed.cover_url }} style={s.spotlightCover} resizeMode="cover" />
                  ) : (
                    <View style={[s.spotlightCover, s.spotlightCoverFb]}>
                      <Ionicons name="game-controller" size={16} color={ED.copper} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={s.spotlightTitle} numberOfLines={1}>{mostPlayed.title}</Text>
                    {mostPlayed.playtime_minutes > 0 && (
                      <Text style={s.spotlightHours}>{formatHours(mostPlayed.playtime_minutes)} played</Text>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* Stats grid */}
            <View style={s.statsGrid}>
              {[
                { val: stats.completed, lbl: t('share_completed', lang), color: ED.plum },
                { val: stats.total, lbl: t('share_total', lang), color: ED.copper },
                { val: `${stats.total_playtime_hours}h`, lbl: t('share_playtime', lang), color: ED.sky },
                { val: `${completionRate}%`, lbl: t('share_win_rate', lang), color: ED.moss },
              ].map(({ val, lbl, color }) => (
                <View key={lbl} style={s.statBox}>
                  <Text style={[s.statVal, { color }]}>{val}</Text>
                  <Text style={s.statLbl}>{lbl}</Text>
                </View>
              ))}
            </View>

            <View style={s.cardFooterRow}>
              <Text style={s.cardFooterText}>BacklogFlow · backlogflow.app</Text>
            </View>
          </View>
        </ViewShot>

        <TouchableOpacity
          style={s.shareBtn}
          onPress={() => captureAndShare(profileRef, t('share_dialog_title', lang), setSharingProfile)}
          disabled={sharingProfile}
          activeOpacity={0.85}
        >
          {sharingProfile ? (
            <ActivityIndicator color="#1A1108" size="small" />
          ) : (
            <>
              <Ionicons name="share-social" size={16} color="#1A1108" />
              <Text style={s.shareBtnText}>{t('share_share_btn', lang)}</Text>
            </>
          )}
        </TouchableOpacity>

        {/* ── Section: Shame Meter ────────────────────────────────────── */}
        <View style={[s.sectionHead, { marginTop: 8 }]}>
          <Text style={s.sectionEyebrow}>02 / BACKLOG SHAME METER</Text>
          <Text style={s.sectionSub}>{t('shame_section_sub', lang)}</Text>
        </View>

        <ViewShot ref={shameRef} options={{ format: 'png', quality: 0.95 }}>
          <View style={s.shameCard}>
            {/* Top row */}
            <View style={s.shameTop}>
              <Text style={s.shameTitleLabel}>BACKLOG SHAME METER</Text>
              <View style={s.shameDegree}>
                <Text style={s.shameDegreeText}>{degree}</Text>
              </View>
            </View>

            <Text style={s.shamePlayer}>{playerName}</Text>

            {/* The bar */}
            <View style={s.shameBarWrap}>
              <Text style={s.shameBarChars}>{bar}</Text>
              <Text style={s.shamePct}>{shame}<Text style={s.shamePctUnit}>%</Text></Text>
            </View>

            {/* Verdict */}
            <View style={s.verdictBox}>
              <Text style={s.verdictLabel}>{t('shame_verdict_label', lang)}</Text>
              <Text style={s.verdictText}>{verdict}</Text>
            </View>

            {/* Mini stats */}
            <View style={s.shameStatsRow}>
              {[
                { val: String(stats.total), lbl: t('shame_stat_games', lang) },
                { val: String(stats.completed), lbl: t('shame_stat_finished', lang) },
                { val: `${stats.total_hours_remaining}h`, lbl: t('shame_stat_remaining', lang) },
              ].map(({ val, lbl }, i) => (
                <React.Fragment key={lbl}>
                  {i > 0 && <View style={s.shameStatDivider} />}
                  <View style={s.shameStat}>
                    <Text style={s.shameStatVal}>{val}</Text>
                    <Text style={s.shameStatLbl}>{lbl}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>

            <Text style={s.shameFooter}>{t('shame_footer', lang)}</Text>
          </View>
        </ViewShot>

        <TouchableOpacity
          style={[s.shareBtn, s.shamShareBtn]}
          onPress={() => captureAndShare(shameRef, t('shame_share_btn', lang), setSharingShame)}
          disabled={sharingShame}
          activeOpacity={0.85}
        >
          {sharingShame ? (
            <ActivityIndicator color={ED.ink} size="small" />
          ) : (
            <>
              <Text style={{ fontSize: 15 }}>🔥</Text>
              <Text style={[s.shareBtnText, { color: ED.ink }]}>{t('shame_share_btn', lang)}</Text>
            </>
          )}
        </TouchableOpacity>

        {/* ── Section: Library Value ──────────────────────────────────── */}
        <View style={[s.sectionHead, { marginTop: 8 }]}>
          <Text style={s.sectionEyebrow}>03 / LIBRARY VALUE</Text>
          <Text style={s.sectionSub}>{t('share_library_value_sub', lang)}</Text>
        </View>

        <ViewShot ref={libraryRef} options={{ format: 'png', quality: 0.95 }}>
          <View style={s.libraryCard}>
            <View style={s.libraryTopRow}>
              <Text style={s.libraryAppLabel}>BACKLOGFLOW</Text>
              <Text style={s.libraryPlayer}>{playerName}</Text>
            </View>

            {priced.length === 0 ? (
              <View style={s.libraryEmpty}>
                <Ionicons name="wallet-outline" size={36} color={ED.ink4} />
                <Text style={s.libraryEmptyText}>{t('share_library_no_prices', lang)}</Text>
              </View>
            ) : (
              <>
                <View style={s.libraryHero}>
                  <Text style={s.libraryHeroLabel}>{t('share_library_value', lang).toUpperCase()}</Text>
                  <Text style={s.libraryHeroValue}>{formatCents(totalCents, currency)}</Text>
                  <Text style={s.libraryHeroSub}>{priced.length} {t('share_priced_games', lang)}</Text>
                </View>

                <View style={s.libraryStatsRow}>
                  <View style={s.libraryStatBox}>
                    <Text style={[s.libraryStatVal, { color: ED.copper }]}>{formatCents(avgCents, currency)}</Text>
                    <Text style={s.libraryStatLbl}>{t('share_avg_price', lang)}</Text>
                  </View>
                  {hoursPerUnit && (
                    <View style={s.libraryStatBox}>
                      <Text style={[s.libraryStatVal, { color: ED.sky }]}>{hoursPerUnit}h</Text>
                      <Text style={s.libraryStatLbl}>{t('share_hours_per_dollar', lang)}</Text>
                    </View>
                  )}
                </View>

                {mostExp && (
                  <View style={s.libraryMostExp}>
                    <Text style={s.libraryMostExpLabel}>{t('share_most_exp', lang).toUpperCase()}</Text>
                    <View style={s.libraryMostExpRow}>
                      {mostExp.cover_url ? (
                        <Image source={{ uri: mostExp.cover_url }} style={s.libraryMostExpCover} resizeMode="cover" />
                      ) : null}
                      <View style={{ flex: 1 }}>
                        <Text style={s.libraryMostExpTitle} numberOfLines={1}>{mostExp.title}</Text>
                        <Text style={[s.libraryMostExpPrice, { color: ED.sky }]}>
                          {formatCents(mostExp.price_cents ?? 0, currency)}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </>
            )}

            <View style={s.libraryFooter}>
              <Text style={s.libraryFooterText}>BacklogFlow · backlogflow.app</Text>
            </View>
          </View>
        </ViewShot>

        <TouchableOpacity
          style={[s.shareBtn, { backgroundColor: ED.sky }]}
          onPress={() => captureAndShare(libraryRef, t('share_library_value_title', lang), setSharingLibrary)}
          disabled={sharingLibrary || priced.length === 0}
          activeOpacity={0.85}
        >
          {sharingLibrary ? (
            <ActivityIndicator color="#1A1108" size="small" />
          ) : (
            <>
              <Ionicons name="wallet-outline" size={16} color="#1A1108" />
              <Text style={s.shareBtnText}>{t('share_library_value_title', lang)}</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: ED.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: ED.line,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: ED.surface2, alignItems: 'center', justifyContent: 'center',
  },
  headerEyebrow: {
    fontFamily: MONO_FONT, fontSize: 9, fontWeight: '600', letterSpacing: 1.4,
    color: ED.copper, textTransform: 'uppercase',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.8, color: ED.ink, marginTop: 2 },

  scroll: { paddingHorizontal: 20, paddingTop: 20 },

  sectionHead: { marginBottom: 12 },
  sectionEyebrow: {
    fontFamily: MONO_FONT, fontSize: 10, fontWeight: '600', letterSpacing: 1.4,
    color: ED.copper, textTransform: 'uppercase',
  },
  sectionSub: { fontSize: 12, color: ED.ink3, marginTop: 3 },

  // ── Profile card ──────────────────────────────────────────────
  profileCard: {
    backgroundColor: ED.surface1, borderRadius: 18,
    borderWidth: 1, borderColor: ED.line,
    overflow: 'hidden', marginBottom: 14,
  },
  heroStrip: { height: 120, position: 'relative', overflow: 'hidden', backgroundColor: ED.surface2 },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(14,12,9,0.55)' },
  appLabel: {
    position: 'absolute', top: 12, right: 14,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, backgroundColor: 'rgba(14,12,9,0.7)',
    borderWidth: 1, borderColor: ED.copperLine,
  },
  appLabelText: {
    fontFamily: MONO_FONT, fontSize: 8, fontWeight: '600',
    letterSpacing: 1.2, color: ED.copper,
  },
  profileRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 10,
  },
  avatar: {
    width: 46, height: 46, borderRadius: 12,
    backgroundColor: ED.copperBg, borderWidth: 1, borderColor: ED.copperLine,
    alignItems: 'center', justifyContent: 'center',
  },
  playerName: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5, color: ED.ink },
  playerSub: { fontSize: 11, color: ED.ink3, marginTop: 2 },
  rateBadge: {
    alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, backgroundColor: ED.mossBg,
    borderWidth: 1, borderColor: ED.moss + '40',
  },
  rateBadgeNum: { fontSize: 18, fontWeight: '800', color: ED.moss, letterSpacing: -0.5 },
  rateBadgeLbl: { fontFamily: MONO_FONT, fontSize: 8, color: ED.moss, letterSpacing: 1 },

  spotlightRow: { paddingHorizontal: 18, paddingBottom: 14 },
  spotlightLabel: {
    fontFamily: MONO_FONT, fontSize: 9, fontWeight: '600', letterSpacing: 1.2,
    color: ED.ink3, marginBottom: 8,
  },
  spotlightInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  spotlightCover: { width: 44, height: 58, borderRadius: 6 },
  spotlightCoverFb: { backgroundColor: ED.copperBg, alignItems: 'center', justifyContent: 'center' },
  spotlightTitle: { fontSize: 14, fontWeight: '700', color: ED.ink, marginBottom: 4 },
  spotlightHours: { fontSize: 12, fontWeight: '700', color: ED.copper },

  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    borderTopWidth: 1, borderTopColor: ED.line,
    marginHorizontal: 18, marginBottom: 0,
  },
  statBox: {
    width: '50%', paddingVertical: 14, paddingHorizontal: 6,
    alignItems: 'center', borderBottomWidth: 0,
  },
  statVal: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginBottom: 3 },
  statLbl: { fontFamily: MONO_FONT, fontSize: 9, color: ED.ink3, letterSpacing: 0.8 },

  cardFooterRow: {
    alignItems: 'center', paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: ED.line, marginHorizontal: 18,
  },
  cardFooterText: { fontFamily: MONO_FONT, fontSize: 9, color: ED.ink4, letterSpacing: 0.8 },

  // ── Share button ──────────────────────────────────────────────
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 50, borderRadius: 14, marginBottom: 28,
    backgroundColor: ED.copper,
  },
  shamShareBtn: {
    backgroundColor: '#2A1008',
    borderWidth: 1, borderColor: ED.rust + '60',
  },
  shareBtnText: { fontSize: 14, fontWeight: '700', color: '#1A1108' },

  // ── Shame card ────────────────────────────────────────────────
  shameCard: {
    backgroundColor: '#0B0608',
    borderRadius: 18, borderWidth: 1, borderColor: ED.rust + '35',
    padding: 24, marginBottom: 14, alignItems: 'center',
    overflow: 'hidden',
  },
  shameTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    alignSelf: 'stretch', marginBottom: 10,
  },
  shameTitleLabel: {
    fontFamily: MONO_FONT, fontSize: 10, fontWeight: '700',
    color: '#C05030', letterSpacing: 2,
  },
  shameDegree: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    backgroundColor: 'rgba(193,104,71,0.12)', borderWidth: 1, borderColor: '#C05030' + '40',
  },
  shameDegreeText: {
    fontFamily: MONO_FONT, fontSize: 8, fontWeight: '700',
    color: '#C05030', letterSpacing: 1.2,
  },
  shamePlayer: {
    fontSize: 26, fontWeight: '800', letterSpacing: -0.8, color: '#F0E8DE',
    marginBottom: 20, textAlign: 'center',
  },
  shameBarWrap: { alignItems: 'center', marginBottom: 20, alignSelf: 'stretch' },
  shameBarChars: {
    fontFamily: MONO_FONT, fontSize: 15, color: '#C05030',
    letterSpacing: 2, fontVariant: ['tabular-nums' as any],
    marginBottom: 6,
  },
  shamePct: {
    fontFamily: MONO_FONT, fontSize: 56, fontWeight: '700',
    color: '#E8684A', letterSpacing: -2, lineHeight: 60,
  },
  shamePctUnit: { fontSize: 24, letterSpacing: 0 },

  verdictBox: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(193,104,71,0.07)',
    borderWidth: 1, borderColor: 'rgba(193,104,71,0.20)',
    borderRadius: 12, padding: 16,
    alignItems: 'center', marginBottom: 22,
  },
  verdictLabel: {
    fontFamily: MONO_FONT, fontSize: 9, fontWeight: '700',
    color: '#C05030', letterSpacing: 1.5, marginBottom: 8,
  },
  verdictText: {
    fontSize: 17, fontWeight: '800', color: '#F0E8DE',
    textAlign: 'center', lineHeight: 24, letterSpacing: -0.3,
  },

  shameStatsRow: {
    flexDirection: 'row', alignItems: 'center',
    alignSelf: 'stretch', justifyContent: 'space-around', marginBottom: 20,
  },
  shameStat: { alignItems: 'center' },
  shameStatDivider: { width: 1, height: 32, backgroundColor: 'rgba(193,104,71,0.20)' },
  shameStatVal: { fontSize: 20, fontWeight: '800', color: '#F0E8DE', letterSpacing: -0.5 },
  shameStatLbl: {
    fontFamily: MONO_FONT, fontSize: 9, color: '#5A4838', letterSpacing: 0.8, marginTop: 3,
  },
  shameFooter: {
    fontFamily: MONO_FONT, fontSize: 9, color: '#3A2A20',
    letterSpacing: 0.8, textTransform: 'uppercase',
  },

  // ── Library card ──────────────────────────────────────────────
  libraryCard: {
    backgroundColor: ED.surface1, borderRadius: 18,
    borderWidth: 1, borderColor: ED.line,
    padding: 22, marginBottom: 14, overflow: 'hidden',
  },
  libraryTopRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18,
  },
  libraryAppLabel: {
    fontFamily: MONO_FONT, fontSize: 9, fontWeight: '600',
    letterSpacing: 1.4, color: ED.copper,
  },
  libraryPlayer: { fontSize: 13, fontWeight: '700', color: ED.ink2 },

  libraryEmpty: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  libraryEmptyText: { fontSize: 13, color: ED.ink3, textAlign: 'center' },

  libraryHero: { alignItems: 'center', marginBottom: 18 },
  libraryHeroLabel: {
    fontFamily: MONO_FONT, fontSize: 9, fontWeight: '600',
    letterSpacing: 1.4, color: ED.ink3, marginBottom: 6,
  },
  libraryHeroValue: {
    fontSize: 42, fontWeight: '800', letterSpacing: -1, color: ED.sky, marginBottom: 4,
  },
  libraryHeroSub: { fontSize: 12, color: ED.ink3 },

  libraryStatsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  libraryStatBox: {
    flex: 1, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 8,
    backgroundColor: ED.surface2, borderWidth: 1, borderColor: ED.line,
    alignItems: 'center',
  },
  libraryStatVal: { fontSize: 18, fontWeight: '800', marginBottom: 3 },
  libraryStatLbl: { fontFamily: MONO_FONT, fontSize: 9, color: ED.ink3, letterSpacing: 0.8, textAlign: 'center' },

  libraryMostExp: {
    borderTopWidth: 1, borderTopColor: ED.line,
    paddingTop: 14, marginBottom: 14,
  },
  libraryMostExpLabel: {
    fontFamily: MONO_FONT, fontSize: 9, fontWeight: '600',
    letterSpacing: 1.4, color: ED.ink3, marginBottom: 8,
  },
  libraryMostExpRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  libraryMostExpCover: { width: 38, height: 50, borderRadius: 6 },
  libraryMostExpTitle: { fontSize: 13, fontWeight: '700', color: ED.ink, marginBottom: 3 },
  libraryMostExpPrice: { fontSize: 15, fontWeight: '800' },

  libraryFooter: {
    alignItems: 'center', paddingTop: 12,
    borderTopWidth: 1, borderTopColor: ED.line,
  },
  libraryFooterText: {
    fontFamily: MONO_FONT, fontSize: 9, color: ED.ink4, letterSpacing: 0.8,
  },
});
