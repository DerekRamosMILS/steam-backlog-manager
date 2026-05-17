import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useGames } from '../../src/hooks/useGames';
import { StatCard } from '../../src/components/StatCard';
import { GlassCard } from '../../src/components/GlassCard';
import { SectionHeader } from '../../src/components/SectionHeader';
import { formatBacklogHours } from '../../src/utils/formatters';
import { useAppContext } from '../../src/hooks/useAppContext';
import { t, Language } from '../../src/i18n';
import { BacklogStats, Game } from '../../src/types';
import { getAllSettings } from '../../src/database/queries';

const DAILY_PLAY_SCENARIOS = [1, 2, 3];

export default function StatsScreen() {
  const { themeColors, language } = useAppContext();
  const { games, stats, refresh } = useGames();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const completionRate =
    stats && stats.total > 0
      ? Math.round((stats.completed / stats.total) * 100)
      : 0;

  const backlogRate =
    stats && stats.total > 0
      ? Math.round(((stats.total - stats.completed) / stats.total) * 100)
      : 0;

  const statusBreakdown = stats
    ? [
      { label: t('stats_playing', language), value: stats.playing, color: themeColors.green },
      { label: t('stats_up_next', language), value: stats.up_next, color: themeColors.blue },
      { label: t('stats_paused', language), value: stats.paused, color: themeColors.violet },
      { label: t('stats_completed', language), value: stats.completed, color: themeColors.accent },
      { label: t('stats_abandoned', language), value: stats.abandoned, color: themeColors.red },
      { label: t('stats_not_started', language), value: stats.not_started, color: themeColors.textMuted },
    ]
    : [];

  const realisticBacklog = stats
    ? DAILY_PLAY_SCENARIOS.map((hoursPerDay) => ({
      hoursPerDay,
      label: formatBacklogDuration(stats.total_hours_remaining, hoursPerDay, language),
    }))
    : [];

  const shame = stats ? computeShame(stats) : 0;
  const shameVerdict = stats ? getShameVerdict(shame, stats.total_hours_remaining, language) : '';
  const shameBar = stats ? shameBarStr(shame) : '';

  const { currency } = getAllSettings();
  const libValue = computeLibraryValue(games);
  const currencySymbol = currency.toUpperCase() === 'MXN' ? 'MX$' : '$';

  return (
    <View style={[styles.root, { backgroundColor: themeColors.bg }]}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[themeColors.bg, themeColors.card]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>{t('stats_title', language)}</Text>
          <Text style={[styles.subtitle, { color: themeColors.textMuted }]}>{t('stats_subtitle', language)}</Text>
        </View>

        {/* Big stats */}
        {stats && (
          <>
            {/* Backlog countdown */}
            <GlassCard style={styles.countdown} padding={20}>
              <LinearGradient
                colors={[themeColors.accent + '25', themeColors.orange + '10']}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="hourglass" size={28} color={themeColors.orange} />
              <Text style={[styles.countdownHours, { color: themeColors.textPrimary }]}>
                {formatBacklogHours(stats.total_hours_remaining)}
              </Text>
              <Text style={[styles.countdownLabel, { color: themeColors.textSecondary }]}>{t('stats_countdown_label', language)}</Text>
            </GlassCard>

            <View style={styles.section}>
              <SectionHeader
                title={t('stats_realistic_pace', language)}
                icon="calendar"
                iconColor={themeColors.orange}
              />
              <GlassCard padding={16}>
                {realisticBacklog.map((item) => (
                  <View key={item.hoursPerDay} style={[styles.realisticRow, { borderBottomColor: themeColors.glassBorder }]}>
                    <Text style={[styles.realisticLabel, { color: themeColors.textSecondary }]}>{`${t('stats_at_per_day', language)} ${item.hoursPerDay}${t('stats_per_day', language)}`}</Text>
                    <Text style={[styles.realisticValue, { color: themeColors.textPrimary }]}>{item.label}</Text>
                  </View>
                ))}
              </GlassCard>
            </View>

            {/* Four stat cards */}
            <View style={styles.row}>
              <StatCard
                label={t('stats_total_games', language)}
                value={stats.total}
                icon="library"
                color={themeColors.accent}
              />
              <StatCard
                label={t('stats_playtime', language)}
                value={`${stats.total_playtime_hours}h`}
                icon="game-controller"
                color={themeColors.teal}
              />
            </View>
            <View style={[styles.row, { marginTop: 10 }]}>
              <StatCard
                label={t('stats_completed_pct', language)}
                value={`${completionRate}%`}
                icon="checkmark-circle"
                color={themeColors.violet}
                subtitle={`${stats.completed} ${t('stats_of', language)} ${stats.total}`}
              />
              <StatCard
                label={t('stats_backlog_pct', language)}
                value={`${backlogRate}%`}
                icon="archive"
                color={themeColors.red}
                subtitle={`${stats.total - stats.completed} ${t('stats_remaining', language)}`}
              />
            </View>

            <View style={styles.section}>
              <SectionHeader
                title={t('stats_hltb_progress', language)}
                icon="checkmark-done-circle"
                iconColor={themeColors.green}
              />
              <GlassCard padding={16}>
                <View style={[styles.realisticRow, { borderBottomColor: themeColors.glassBorder }]}>
                  <Text style={[styles.realisticLabel, { color: themeColors.textSecondary }]}>{t('stats_hltb_met', language)}</Text>
                  <Text style={[styles.realisticValue, { color: themeColors.textPrimary }]}>{`${stats.hltb_target_met} ${t('stats_games', language)}`}</Text>
                </View>
                <View style={[styles.realisticRow, { borderBottomColor: themeColors.glassBorder }]}>
                  <Text style={[styles.realisticLabel, { color: themeColors.textSecondary }]}>{t('stats_hltb_ready', language)}</Text>
                  <Text style={[styles.realisticValue, { color: themeColors.textPrimary }]}>{`${stats.hltb_ready_to_finish} ${t('stats_games', language)}`}</Text>
                </View>
                <View style={[styles.realisticRow, { borderBottomColor: themeColors.glassBorder }]}>
                  <Text style={[styles.realisticLabel, { color: themeColors.textSecondary }]}>{t('stats_hltb_excluded', language)}</Text>
                  <Text style={[styles.realisticValue, { color: themeColors.textPrimary }]}>{`${stats.excluded_from_backlog} ${t('stats_games', language)}`}</Text>
                </View>
              </GlassCard>
            </View>

            {/* Status breakdown */}
            <View style={styles.section}>
              <SectionHeader
                title={t('stats_by_status', language)}
                icon="pie-chart"
                iconColor={themeColors.accent}
              />
              <GlassCard padding={16}>
                {statusBreakdown.map((item) => (
                  <View key={item.label} style={styles.breakdownRow}>
                    <View style={[styles.dot, { backgroundColor: item.color }]} />
                    <Text style={[styles.breakdownLabel, { color: themeColors.textSecondary }]}>{item.label}</Text>
                    <View style={[styles.breakdownBarWrap, { backgroundColor: themeColors.glassBorder }]}>
                      <View
                        style={[
                          styles.breakdownBar,
                          {
                            width: stats.total > 0
                              ? `${Math.round((item.value / stats.total) * 100)}%` as any
                              : '0%',
                            backgroundColor: item.color,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.breakdownValue, { color: item.color }]}>
                      {item.value}
                    </Text>
                  </View>
                ))}
              </GlassCard>
            </View>

            {/* Library Value */}
            {libValue.countWithPrice > 0 && (
              <View style={styles.section}>
                <SectionHeader
                  title={t('lbl_library_value' as any, language)}
                  icon="cash"
                  iconColor={themeColors.green}
                />
                <GlassCard padding={20} borderColor={themeColors.green + '44'} style={{ overflow: 'hidden' }}>
                  <LinearGradient
                    colors={[themeColors.green + '14', 'transparent']}
                    style={StyleSheet.absoluteFill}
                  />
                  <Text style={[styles.shameLevelLabel, { color: themeColors.textMuted }]}>
                    {t('share_total' as any, language)}: {libValue.countWithPrice}
                  </Text>

                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: currency === 'mxn' ? 28 : 44, fontWeight: '900', color: themeColors.green, letterSpacing: -1 }}>
                      {currencySymbol}{(libValue.totalCents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: currency === 'mxn' ? 0 : 2 })}
                    </Text>
                  </View>

                  <View style={styles.verdictBox}>
                    <Text style={[styles.verdictLabel, { color: themeColors.green }]}>{t('share_hours_per_dollar' as any, language)}</Text>
                    <Text style={[styles.verdictText, { color: themeColors.textPrimary }]}>
                      {libValue.hoursPerUnit.toFixed(2)} {t('share_hours' as any, language)} / {currencySymbol}1
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={[styles.verdictBox, { flex: 1, marginBottom: 0 }]}>
                      <Text style={[styles.verdictLabel, { color: themeColors.green }]}>{t('share_avg_price' as any, language)}</Text>
                      <Text style={[styles.verdictText, { color: themeColors.textPrimary }]}>
                        {currencySymbol}{(libValue.averageCents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: currency === 'mxn' ? 0 : 2 })}
                      </Text>
                    </View>
                    <View style={[styles.verdictBox, { flex: 1, marginBottom: 0 }]}>
                      <Text style={[styles.verdictLabel, { color: themeColors.green }]}>{t('share_most_exp' as any, language)}</Text>
                      <Text style={[styles.verdictText, { color: themeColors.textPrimary }]} numberOfLines={1}>
                        {libValue.mostExpAppName}
                      </Text>
                      <Text style={{ fontSize: 11, color: themeColors.textMuted, marginTop: 4 }}>
                        {currencySymbol}{(libValue.mostExpCents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: currency === 'mxn' ? 0 : 2 })}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.shameHint, { color: themeColors.textMuted }]}>
                    💰 BacklogFlow Library Report
                  </Text>
                </GlassCard>
              </View>
            )}

            {/* Backlog Shame Meter */}
            <View style={styles.section}>
              <SectionHeader
                title={t('shame_section_title', language)}
                icon="flame"
                iconColor="#ff4500"
              />
              <GlassCard padding={20} borderColor="#ff450044" style={{ overflow: 'hidden' }}>
                <LinearGradient
                  colors={['#ff430014', 'transparent']}
                  style={StyleSheet.absoluteFill}
                />
                {/* Level label + bar */}
                <Text style={[styles.shameLevelLabel, { color: themeColors.textMuted }]}>
                  {t('shame_level_label', language)}
                </Text>
                <Text style={styles.shameBarChars}>{shameBar}</Text>
                <Text style={styles.shamePct}>{shame}%</Text>

                {/* Verdict box */}
                <View style={styles.verdictBox}>
                  <Text style={styles.verdictLabel}>{t('shame_verdict_label', language)}</Text>
                  <Text style={[styles.verdictText, { color: themeColors.textPrimary }]}>
                    {shameVerdict}
                  </Text>
                </View>

                <Text style={[styles.shameHint, { color: themeColors.textMuted }]}>
                  🔥 {t('shame_share_btn', language)}
                </Text>
              </GlassCard>
            </View>
          </>
        )}

        {!stats && (
          <View style={styles.empty}>
            <Ionicons name="bar-chart-outline" size={48} color={themeColors.textMuted} />
            <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>{t('stats_no_data', language)}</Text>
            <Text style={[styles.emptySubText, { color: themeColors.textMuted }]}>
              {t('stats_no_data_sub', language)}
            </Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

function computeLibraryValue(games: Game[]) {
  let totalCents = 0;
  let countWithPrice = 0;
  let mostExpCents = 0;
  let mostExpAppName = '';
  let totalMinutes = 0;

  for (const g of games) {
    if (g.price_cents !== null && g.price_cents !== undefined) {
      totalCents += g.price_cents;
      countWithPrice++;
      if (g.price_cents > mostExpCents) {
        mostExpCents = g.price_cents;
        mostExpAppName = g.title;
      }
    }
    // Only count playtime for paid games (cents > 0) to get accurate hours/dollar
    // Alternatively, just count playtime for all games that DO have a price entry 
    if (g.price_cents !== null && g.price_cents !== undefined && g.price_cents >= 0) {
      totalMinutes += g.playtime_minutes;
    }
  }

  const hoursPerUnit = totalCents > 0 ? (totalMinutes / 60) / (totalCents / 100) : 0;
  const averageCents = countWithPrice > 0 ? totalCents / countWithPrice : 0;

  return { totalCents, averageCents, mostExpAppName, mostExpCents, hoursPerUnit, countWithPrice };
}

function computeShame(stats: BacklogStats): number {
  const backlog = stats.not_started + stats.up_next + stats.paused + stats.playing;
  let shame = stats.total > 0 ? Math.round((backlog / stats.total) * 100) : 0;
  if (stats.total > 100) shame = Math.min(100, shame + 15);
  else if (stats.total > 50) shame = Math.min(100, shame + 8);
  if (stats.total_hours_remaining > 500) shame = Math.min(100, shame + 10);
  else if (stats.total_hours_remaining > 200) shame = Math.min(100, shame + 5);
  return Math.max(5, Math.min(100, shame));
}

function getShameVerdict(shame: number, hoursRemaining: number, lang: Language): string {
  const finishYear = new Date().getFullYear() + Math.ceil(hoursRemaining / 365);
  const tiers: Array<{ min: number; en: string; es: string }> = [
    { min: 0, en: "You're suspiciously functional.\nAre you okay?", es: 'Eres sospechosamente funcional.\n¿Estás bien?' },
    { min: 20, en: 'A healthy backlog.\nA lie you tell yourself.', es: 'Un backlog saludable.\nUna mentira que te dices.' },
    { min: 40, en: 'The backlog grows.\nSteam sales were a mistake.', es: 'El backlog crece.\nLas ofertas de Steam fueron un error.' },
    { min: 55, en: 'Certified game hoarder.', es: 'Acumulador certificado de juegos.' },
    { min: 68, en: "Your backlog is a\nsmall country's GDP.", es: 'Tu backlog equivale\nal PIB de un país pequeño.' },
    { min: 80, en: `You could finish your backlog\nin ${finishYear}. Good luck.`, es: `Podrías terminar tu backlog\nen ${finishYear}. Buena suerte.` },
    { min: 92, en: 'Steam therapist recommended.\nImmediately.', es: 'Se recomienda terapeuta de Steam.\nInmediatamente.' },
  ];
  let verdict = tiers[0];
  for (const tier of tiers) {
    if (shame >= tier.min) verdict = tier;
  }
  return lang === 'es' ? verdict.es : verdict.en;
}

function shameBarStr(shame: number): string {
  const filled = Math.round(shame / 5);
  return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, 20 - filled));
}

function formatBacklogDuration(totalHours: number, hoursPerDay: number, lang: Language): string {
  if (totalHours <= 0 || hoursPerDay <= 0) {
    return t('stats_done', lang);
  }

  const totalDays = totalHours / hoursPerDay;
  const years = totalDays / 365;

  if (years >= 1) {
    const roundedYears = Math.round(years * 10) / 10;
    return `${roundedYears} ${t('stats_years', lang)}`;
  }

  const months = totalDays / 30;
  if (months >= 1) {
    const roundedMonths = Math.round(months * 10) / 10;
    return `${roundedMonths} ${t('stats_months', lang)}`;
  }

  return `${Math.ceil(totalDays)} ${t('stats_days', lang)}`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingTop: 60, paddingHorizontal: 20 },
  header: { marginBottom: 24 },
  title: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  subtitle: { fontSize: 13, marginTop: 2 },
  countdown: {
    alignItems: 'center',
    marginBottom: 20,
    overflow: 'hidden',
    gap: 8,
  },
  countdownHours: {
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1,
    textAlign: 'center',
  },
  countdownLabel: {
    fontSize: 13,
    textAlign: 'center',
  },
  row: { flexDirection: 'row', gap: 10 },
  section: { marginTop: 24 },
  realisticRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  realisticLabel: {
    fontSize: 14,
  },
  realisticValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  breakdownLabel: {
    fontSize: 13,
    width: 90,
  },
  breakdownBarWrap: {
    flex: 1,
    height: 6,
    borderRadius: 99,
    overflow: 'hidden',
  },
  breakdownBar: {
    height: '100%',
    borderRadius: 99,
    minWidth: 4,
    opacity: 0.8,
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: '700',
    width: 28,
    textAlign: 'right',
  },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 16, fontWeight: '600' },
  emptySubText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  // ── Shame Meter ────────────────────────────────────────────
  shameLevelLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  shameBarChars: {
    color: '#ff4500',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  shamePct: {
    color: '#ff6535',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
    marginBottom: 16,
  },
  verdictBox: {
    backgroundColor: 'rgba(255,69,0,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,69,0,0.25)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  verdictLabel: {
    color: '#ff6535',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  verdictText: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 24,
  },
  shameHint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
});
