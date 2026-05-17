import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useGames } from '../hooks/useGames';
import { formatBacklogHours } from '../utils/formatters';
import { useAppContext } from '../hooks/useAppContext';
import { t, Language } from '../i18n';
import { BacklogStats, Game } from '../types';
import { getAllSettings } from '../database/queries';
import { calculateCompletionTimeline } from '../services/plannerService';
import { ED, edStyles, MONO_FONT, STATUS_COLORS } from '../styles/editorial';

const DAILY_SCENARIOS: { v: string; h: number; sub: string }[] = [
  { v: '1h', h: 1, sub: 'casual' },
  { v: '2h', h: 2, sub: 'regular' },
  { v: '4h', h: 4, sub: 'heavy' },
  { v: '8h', h: 8, sub: 'extreme' },
];

export default function InsightsScreen() {
  const { language } = useAppContext();
  const { games, stats, refresh } = useGames();
  const [planHours, setPlanHours] = useState(2);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const { currency } = getAllSettings();
  const currencySymbol = currency.toUpperCase() === 'MXN' ? 'MX$' : '$';

  const completionRate = stats && stats.total > 0
    ? Math.round((stats.completed / stats.total) * 100) : 0;
  const backlogRate = stats && stats.total > 0
    ? Math.round(((stats.total - stats.completed) / stats.total) * 100) : 0;
  const hitRate = stats && (stats.completed + stats.abandoned) > 0
    ? Math.round((stats.completed / (stats.completed + stats.abandoned)) * 100) : 0;

  const shame = stats ? computeShame(stats) : 0;
  const shameVerdict = stats ? getShameVerdict(shame, stats.total_hours_remaining, language as Language) : '';
  const shameDiagnosis = stats ? getShameDiagnosis(shame, stats, language as Language) : '';

  const libValue = computeLibraryValue(games);

  const plan = calculateCompletionTimeline(planHours);
  const planYears = plan.monthsToComplete / 12;
  const planDays = Math.round(plan.monthsToComplete * 30.44);
  const planDate = plan.estimatedDate;
  const planDateStr = planDate.toLocaleDateString(language === 'es' ? 'es-MX' : 'en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  const statusBreakdown = stats ? [
    { label: 'Not started', value: stats.not_started, color: ED.ink4 },
    { label: 'Up Next', value: stats.up_next, color: ED.sky },
    { label: 'Playing', value: stats.playing, color: ED.moss },
    { label: 'Paused', value: stats.paused, color: ED.amber },
    { label: 'Completed', value: stats.completed, color: ED.plum },
    { label: 'Abandoned', value: stats.abandoned, color: ED.rust },
  ] : [];

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={s.header}>
          <Text style={[edStyles.eyebrow, { marginBottom: 6 }]}>YOUR BACKLOG · IN NUMBERS</Text>
          <Text style={[edStyles.displayTitle, { fontSize: 38 }]}>Insights.</Text>
        </View>

        {stats ? (
          <>
            {/* ── Planner ── */}
            <View style={s.section}>
              <View style={edStyles.sectionHead}>
                <Text style={[edStyles.eyebrow, { color: ED.copper }]}>◆ Planner</Text>
              </View>

              <View style={edStyles.card}>
                <View style={{ padding: 20 }}>
                  <Text style={[edStyles.eyebrow, { marginBottom: 12 }]}>If you play</Text>
                  <View style={s.planBtns}>
                    {DAILY_SCENARIOS.map((sc) => {
                      const active = planHours === sc.h;
                      return (
                        <TouchableOpacity
                          key={sc.v}
                          style={[s.planBtn, active && s.planBtnActive]}
                          onPress={() => setPlanHours(sc.h)}
                          activeOpacity={0.75}
                        >
                          <Text style={[s.planBtnVal, active && s.planBtnValActive]}>{sc.v}</Text>
                          <Text style={[s.planBtnSub, active && s.planBtnSubActive]}>{sc.sub}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Big number */}
                  <View style={s.planResult}>
                    <Text style={[edStyles.eyebrow, { marginBottom: 10 }]}>You'd clear your backlog in</Text>
                    <View style={s.planYearRow}>
                      <Text style={s.planYearNum}>{planYears.toFixed(2)}</Text>
                      <Text style={s.planYearLabel}>years</Text>
                    </View>
                    <Text style={s.planSub}>
                      <Text style={[s.planMono]}>{planDays} days</Text>
                      {'  ·  finishing '}
                      <Text style={s.planMono}>{planDateStr}</Text>
                    </Text>
                  </View>

                  {/* Mini timeline bar */}
                  <View style={{ marginTop: 20 }}>
                    <View style={s.timelineBar}>
                      {statusBreakdown.filter(b => ['Not started', 'Up Next', 'Playing', 'Paused'].includes(b.label)).map((b, i, arr) => (
                        <View
                          key={b.label}
                          style={[
                            s.timelineSegment,
                            {
                              flex: b.value,
                              backgroundColor: b.color,
                              borderRightWidth: i < arr.length - 1 ? 1 : 0,
                            },
                          ]}
                        />
                      ))}
                    </View>
                    <View style={s.timelineLabels}>
                      {['TODAY', 'HALFWAY', planDateStr.toUpperCase()].map((l) => (
                        <Text key={l} style={s.timelineLabel}>{l}</Text>
                      ))}
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* ── Hero stats ── */}
            <View style={s.section}>
              <View style={edStyles.sectionHead}>
                <Text style={edStyles.eyebrow}>At a glance</Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={[edStyles.card, s.heroCardLg]}>
                  <Text style={edStyles.eyebrow}>Hours to clear</Text>
                  <View style={s.bigNumRow}>
                    <Text style={s.bigNum}>{Math.round(stats.total_hours_remaining)}</Text>
                    <Text style={s.bigNumUnit}>h</Text>
                  </View>
                  <Text style={s.heroCardSub}>HLTB main story estimates</Text>
                </View>
                <View style={[edStyles.card, s.heroCardSm]}>
                  <Text style={edStyles.eyebrow}>Played</Text>
                  <View style={s.bigNumRow}>
                    <Text style={[s.bigNum, { fontSize: 32 }]}>{stats.total_playtime_hours}</Text>
                    <Text style={s.bigNumUnit}>h</Text>
                  </View>
                  <Text style={s.heroCardSub}>across {stats.total} titles</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                {[
                  { label: 'Completion', value: completionRate, unit: '%' },
                  { label: 'Backlog', value: backlogRate, unit: '%' },
                  { label: 'Hit rate', value: hitRate, unit: '%' },
                ].map((stat) => (
                  <View key={stat.label} style={[edStyles.card, s.thirdCard]}>
                    <Text style={edStyles.eyebrow}>{stat.label}</Text>
                    <View style={s.bigNumRow}>
                      <Text style={[s.bigNum, { fontSize: 28 }]}>{stat.value}</Text>
                      <Text style={[s.bigNumUnit, { fontSize: 14 }]}>{stat.unit}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* ── Status breakdown ── */}
            <View style={s.section}>
              <View style={edStyles.sectionHead}>
                <Text style={edStyles.eyebrow}>Status breakdown</Text>
                <Text style={[edStyles.eyebrow, { color: ED.ink3, fontFamily: MONO_FONT }]}>{stats.total} TOTAL</Text>
              </View>

              {/* Stacked bar */}
              <View style={s.stackedBar}>
                {statusBreakdown.map((b) => (
                  <View
                    key={b.label}
                    style={[s.stackedSegment, {
                      flex: b.value || 0.01,
                      backgroundColor: b.color,
                    }]}
                  />
                ))}
              </View>

              <View style={edStyles.card}>
                {statusBreakdown.map((item, idx) => (
                  <View
                    key={item.label}
                    style={[
                      s.breakdownRow,
                      idx < statusBreakdown.length - 1 && { borderBottomWidth: 1, borderBottomColor: ED.line },
                    ]}
                  >
                    <View style={[s.breakdownDot, { backgroundColor: item.color }]} />
                    <Text style={s.breakdownLabel}>{item.label}</Text>
                    <Text style={s.breakdownPct}>
                      {stats.total > 0 ? ((item.value / stats.total) * 100).toFixed(0) : 0}%
                    </Text>
                    <Text style={[s.breakdownVal, { color: item.color }]}>{item.value}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* ── Shame meter ── */}
            <View style={s.section}>
              <View style={edStyles.sectionHead}>
                <Text style={edStyles.eyebrow}>The Backlog Mirror</Text>
                <Text style={[edStyles.eyebrow, { color: ED.ink3 }]}>SHAME METER</Text>
              </View>

              <View style={edStyles.card}>
                <View style={{ padding: 20 }}>
                  <View style={s.shameHeader}>
                    <View>
                      <View style={s.shameNumRow}>
                        <Text style={[s.shameNum, { color: shame > 80 ? ED.rust : ED.copper }]}>{shame}</Text>
                        <Text style={s.shameNumDenom}>/100</Text>
                      </View>
                    </View>
                    <View style={s.shameVerdictBox}>
                      <Text style={[s.shameVerdictTitle, { color: shame > 80 ? ED.rust : ED.amber }]}>
                        {shame > 80 ? 'Concerning.' : shame > 55 ? 'Oof.' : shame > 30 ? 'Room to grow.' : 'Clean slate.'}
                      </Text>
                      <Text style={s.shameVerdictSub}>{shameVerdict.split('\n')[0]}</Text>
                    </View>
                  </View>

                  {/* Gradient bar */}
                  <View style={s.shameBarTrack}>
                    <View style={s.shameBarFill} />
                    <View style={[s.shameBarMarker, { left: `${shame}%` as any }]} />
                  </View>
                  <View style={s.shameBarLabels}>
                    {['SAINT', 'HEALTHY', 'RECKONING'].map((l) => (
                      <Text key={l} style={s.shameBarLabel}>{l}</Text>
                    ))}
                  </View>

                  {/* Diagnosis */}
                  <View style={s.diagnosisCard}>
                    <Text style={s.diagnosisLabel}>DIAGNOSIS</Text>
                    <Text style={s.diagnosisText}>{shameDiagnosis}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* ── Reality check ── */}
            <View style={s.section}>
              <View style={edStyles.sectionHead}>
                <Text style={edStyles.eyebrow}>Reality check</Text>
              </View>
              <View style={edStyles.card}>
                {DAILY_SCENARIOS.map((sc, idx) => {
                  const sim = calculateCompletionTimeline(sc.h);
                  const isSelected = planHours === sc.h;
                  return (
                    <TouchableOpacity
                      key={sc.v}
                      style={[
                        s.realityRow,
                        idx < DAILY_SCENARIOS.length - 1 && { borderBottomWidth: 1, borderBottomColor: ED.line },
                        isSelected && { backgroundColor: ED.copperBg },
                      ]}
                      onPress={() => setPlanHours(sc.h)}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.realityHours, isSelected && { color: ED.copper }]}>{sc.v}/d</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.realityVerdict, isSelected && { color: ED.copper }]}>
                          {formatBacklogDuration(stats.total_hours_remaining, sc.h, language as Language)}
                        </Text>
                        <Text style={s.realitySub}>{sc.sub}</Text>
                      </View>
                      {isSelected && (
                        <View style={s.youPill}>
                          <Text style={s.youPillText}>YOU</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ── Library value ── */}
            {libValue.countWithPrice > 0 && (
              <View style={s.section}>
                <View style={edStyles.sectionHead}>
                  <Text style={edStyles.eyebrow}>Library value</Text>
                  <Text style={[edStyles.eyebrow, { color: ED.ink3 }]}>{currency.toUpperCase()} ESTIMATES</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={[edStyles.card, s.valueCard]}>
                    <Text style={edStyles.eyebrow}>Spent</Text>
                    <Text style={[s.valueNum, { color: ED.ink }]}>
                      {currencySymbol}{Math.round(libValue.totalCents / 100).toLocaleString()}
                    </Text>
                    <Text style={s.valueSub}>across all stores</Text>
                  </View>
                  <View style={[edStyles.card, s.valueCard]}>
                    <Text style={edStyles.eyebrow}>Avg price</Text>
                    <Text style={[s.valueNum, { color: ED.moss }]}>
                      {currencySymbol}{Math.round(libValue.averageCents / 100).toLocaleString()}
                    </Text>
                    <Text style={s.valueSub}>{libValue.countWithPrice} titles tracked</Text>
                  </View>
                </View>
                <View style={[edStyles.card, { marginTop: 10 }]}>
                  <View style={{ padding: 16 }}>
                    <Text style={edStyles.eyebrow}>Hours / {currencySymbol}1</Text>
                    <Text style={[s.valueNum, { color: ED.copper, fontSize: 28, marginTop: 4 }]}>
                      {libValue.hoursPerUnit.toFixed(2)}h
                    </Text>
                    <Text style={s.valueSub}>Most expensive: {libValue.mostExpAppName} ({currencySymbol}{Math.round(libValue.mostExpCents / 100)})</Text>
                  </View>
                </View>
              </View>
            )}

            {/* ── HLTB data ── */}
            <View style={s.section}>
              <View style={edStyles.sectionHead}>
                <Text style={edStyles.eyebrow}>HLTB progress</Text>
              </View>
              <View style={edStyles.card}>
                {[
                  { label: 'Target met', value: stats.hltb_target_met },
                  { label: 'Ready to finish', value: stats.hltb_ready_to_finish },
                  { label: 'Excluded from backlog', value: stats.excluded_from_backlog },
                ].map((row, idx, arr) => (
                  <View
                    key={row.label}
                    style={[edStyles.specRow, idx === arr.length - 1 && { borderBottomWidth: 0 }]}
                  >
                    <Text style={edStyles.specKey}>{row.label}</Text>
                    <Text style={edStyles.specVal}>{row.value} games</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        ) : (
          <View style={s.empty}>
            <Ionicons name="bar-chart-outline" size={48} color={ED.ink4} />
            <Text style={s.emptyTitle}>No data yet</Text>
            <Text style={s.emptySubText}>Add games to your library to see insights</Text>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    { min: 68, en: "Your backlog is a small country's GDP.", es: 'Tu backlog equivale al PIB de un país pequeño.' },
    { min: 80, en: `Finish your backlog in ${finishYear}. Good luck.`, es: `Termina tu backlog en ${finishYear}. Buena suerte.` },
    { min: 92, en: 'Steam therapist recommended. Immediately.', es: 'Se recomienda terapeuta de Steam. Inmediatamente.' },
  ];
  let verdict = tiers[0];
  for (const tier of tiers) {
    if (shame >= tier.min) verdict = tier;
  }
  return lang === 'es' ? verdict.es : verdict.en;
}

function getShameDiagnosis(shame: number, stats: BacklogStats, lang: Language): string {
  const untouched = stats.not_started;
  const tiers: Array<{ min: number; en: string; es: string }> = [
    { min: 0, en: `Clean collection. Only ${untouched} untouched titles. Respect.`, es: `Colección limpia. Solo ${untouched} sin tocar. Respeto.` },
    { min: 25, en: `Mild hoarding detected. ${untouched} games untouched. Manageable.`, es: `Acumulación leve detectada. ${untouched} juegos sin tocar. Manejable.` },
    { min: 45, en: `Chronic sale fever. ${untouched} games untouched. Consider a backlog diet.`, es: `Fiebre crónica de ofertas. ${untouched} juegos sin tocar. Considera una dieta de backlog.` },
    { min: 65, en: `Critical. ${untouched} games untouched. Recommended treatment: stop visiting Steam on Tuesdays.`, es: `Crítico. ${untouched} juegos sin tocar. Tratamiento: deja de visitar Steam los martes.` },
    { min: 80, en: `Terminal. ${untouched} unplayed games. A therapist has been notified.`, es: `Terminal. ${untouched} juegos sin jugar. Se ha notificado a un terapeuta.` },
  ];
  let chosen = tiers[0];
  for (const tier of tiers) {
    if (shame >= tier.min) chosen = tier;
  }
  return lang === 'es' ? chosen.es : chosen.en;
}

function formatBacklogDuration(totalHours: number, hoursPerDay: number, lang: Language): string {
  if (totalHours <= 0 || hoursPerDay <= 0) return t('stats_done', lang);
  const totalDays = totalHours / hoursPerDay;
  const years = totalDays / 365;
  if (years >= 1) return `${(Math.round(years * 10) / 10)} ${t('stats_years', lang)}`;
  const months = totalDays / 30;
  if (months >= 1) return `${(Math.round(months * 10) / 10)} ${t('stats_months', lang)}`;
  return `${Math.ceil(totalDays)} ${t('stats_days', lang)}`;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: ED.bg },
  scroll: { paddingTop: Platform.OS === 'ios' ? 60 : 48, paddingHorizontal: 24 },
  header: { marginBottom: 24 },
  section: { marginBottom: 28 },

  // Planner
  planBtns: { flexDirection: 'row', gap: 6 },
  planBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: ED.line,
    alignItems: 'center',
  },
  planBtnActive: { backgroundColor: ED.ink, borderColor: ED.ink },
  planBtnVal: { fontSize: 18, fontWeight: '700', color: ED.ink2, fontFamily: MONO_FONT },
  planBtnValActive: { color: ED.bg },
  planBtnSub: { fontSize: 9, color: ED.ink3, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
  planBtnSubActive: { color: ED.bg, opacity: 0.7 },
  planResult: { alignItems: 'center', paddingVertical: 14 },
  planYearRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  planYearNum: {
    fontSize: 80, fontWeight: '900', color: ED.copper,
    letterSpacing: -3, lineHeight: 86,
  },
  planYearLabel: {
    fontSize: 22, color: ED.ink3, fontStyle: 'italic',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  planSub: { fontSize: 12.5, color: ED.ink3, marginTop: 8 },
  planMono: { fontFamily: MONO_FONT, color: ED.ink2 },
  timelineBar: {
    height: 28, borderRadius: 8, overflow: 'hidden',
    flexDirection: 'row', backgroundColor: ED.surface3,
  },
  timelineSegment: { borderRightColor: 'rgba(0,0,0,0.3)', opacity: 0.85 },
  timelineLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  timelineLabel: { fontFamily: MONO_FONT, fontSize: 9, color: ED.ink3 },

  // Hero stats
  heroCardLg: { flex: 2, padding: 18 },
  heroCardSm: { flex: 1, padding: 18 },
  thirdCard: { flex: 1, padding: 14 },
  bigNumRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3, marginTop: 4 },
  bigNum: { fontSize: 52, fontWeight: '900', color: ED.ink, letterSpacing: -2 },
  bigNumUnit: { fontSize: 18, color: ED.ink3, fontWeight: '600' },
  heroCardSub: { fontSize: 10, color: ED.ink3, marginTop: 4, fontFamily: MONO_FONT },

  // Status breakdown
  stackedBar: {
    height: 8, borderRadius: 100, overflow: 'hidden',
    flexDirection: 'row', marginBottom: 14,
    backgroundColor: ED.surface3,
  },
  stackedSegment: {},
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: '10px 16px' as any, paddingVertical: 10, paddingHorizontal: 16 },
  breakdownDot: { width: 10, height: 10, borderRadius: 2 },
  breakdownLabel: { flex: 1, fontSize: 13.5, color: ED.ink2, fontWeight: '500' },
  breakdownPct: { fontFamily: MONO_FONT, fontSize: 12, color: ED.ink3 },
  breakdownVal: { fontSize: 18, fontWeight: '700', width: 40, textAlign: 'right' as const },

  // Shame meter
  shameHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 },
  shameNumRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  shameNum: { fontSize: 56, fontWeight: '900', letterSpacing: -2 },
  shameNumDenom: { fontSize: 18, color: ED.ink3, fontWeight: '600', fontFamily: MONO_FONT },
  shameVerdictBox: { flex: 1, paddingLeft: 16, justifyContent: 'center' },
  shameVerdictTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.5 },
  shameVerdictSub: { fontSize: 12, color: ED.ink3, marginTop: 3, fontStyle: 'italic' },
  shameBarTrack: {
    height: 6, backgroundColor: ED.surface3, borderRadius: 100,
    marginTop: 14, overflow: 'visible',
  },
  shameBarFill: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 100, overflow: 'hidden',
    // Gradient approximated with a linear tint
    backgroundColor: ED.moss,
  },
  shameBarMarker: {
    position: 'absolute', top: -3, width: 2, height: 12,
    backgroundColor: ED.ink, marginLeft: -1,
  },
  shameBarLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  shameBarLabel: { fontFamily: MONO_FONT, fontSize: 9, color: ED.ink3 },
  diagnosisCard: {
    marginTop: 18, padding: 14, borderRadius: 10,
    backgroundColor: 'rgba(193,104,71,0.08)',
    borderWidth: 1, borderColor: 'rgba(193,104,71,0.18)',
  },
  diagnosisLabel: {
    fontFamily: MONO_FONT, fontSize: 10, fontWeight: '600',
    letterSpacing: 1.4, textTransform: 'uppercase',
    color: ED.rust, marginBottom: 6,
  },
  diagnosisText: { fontSize: 13, color: ED.ink2, lineHeight: 20 },

  // Reality check
  realityRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  realityHours: { fontFamily: MONO_FONT, fontSize: 14, fontWeight: '600', color: ED.ink, width: 42 },
  realityVerdict: { fontSize: 14, fontWeight: '600', color: ED.ink },
  realitySub: { fontSize: 11, color: ED.ink3, marginTop: 2 },
  youPill: {
    backgroundColor: ED.copper, borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  youPillText: { fontFamily: MONO_FONT, fontSize: 9, fontWeight: '700', color: '#1A1108' },

  // Library value
  valueCard: { flex: 1, padding: 16 },
  valueNum: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, marginTop: 4 },
  valueSub: { fontSize: 11, color: ED.ink3, marginTop: 4 },

  // Empty state
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: ED.ink },
  emptySubText: { fontSize: 13, color: ED.ink3, textAlign: 'center' },
});
