import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useGames } from '../hooks/useGames';
import { useRecommendation } from '../hooks/useRecommendation';
import { useAppContext } from '../hooks/useAppContext';
import { getDailyPick, getRecommendations } from '../services/recommendationService';
import { GameCover } from '../components/GameCover';
import { PickNextGameModal } from '../components/PickNextGameModal';
import { SessionTimerModal } from '../components/SessionTimerModal';
import { ED, edStyles, STATUS_COLORS, MONO_FONT } from '../styles/editorial';
import { t } from '../i18n';
import { Game, Recommendation, DailyPick } from '../types';

export default function DashboardScreen() {
  const router = useRouter();
  const { games, stats, refresh, setStatus, getByStatus } = useGames();
  const { recommendation, refresh: refreshRec, reroll } = useRecommendation();
  const { language, playerName } = useAppContext();
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [timerGame, setTimerGame] = useState<Game | null>(null);
  const [topRecs, setTopRecs] = useState<Recommendation[]>([]);
  const [dailyPick, setDailyPick] = useState<DailyPick | null>(null);

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshRec();
      setDailyPick(getDailyPick());
      setTopRecs(getRecommendations({ limit: 3 }));
    }, [refresh, refreshRec])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    refresh();
    setRefreshing(false);
  };

  const playing = getByStatus('playing');
  const upNext = getByStatus('up_next').slice(0, 3);
  const paused = getByStatus('paused');
  const hero = playing[0] || null;

  const today = new Date();
  const dayName = today.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { weekday: 'long' });
  const monthDay = today.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { month: 'long', day: 'numeric' });

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ED.copper} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={[edStyles.eyebrow, styles.dateLabel]}>
              {dayName} · {monthDay}
            </Text>
            <Text style={styles.greeting}>
              {t('dash_greeting', language)} {playerName || 'Player'}.
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/share' as any)}>
              <Ionicons name="share-outline" size={16} color={ED.ink2} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: ED.copper, borderColor: ED.copper }]}
              onPress={() => setModalVisible(true)}
            >
              <Ionicons name="dice-outline" size={16} color="#1A1108" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Currently Playing Hero ──────────────────────────── */}
        {hero ? (
          <View style={styles.section}>
            <View style={edStyles.sectionHead}>
              <View style={styles.nowPlayingLabel}>
                <View style={[styles.dot, { backgroundColor: ED.moss }]} />
                <Text style={edStyles.eyebrow}>{language === 'es' ? 'Jugando ahora' : 'Now Playing'}</Text>
              </View>
              <Text style={[edStyles.eyebrow, { color: ED.ink4 }]}>
                01 / {playing.length.toString().padStart(2, '0')}
              </Text>
            </View>

            <TouchableOpacity
              style={edStyles.card}
              onPress={() => router.push(`/game/${hero.id}`)}
              activeOpacity={0.9}
            >
              {/* Cover banner */}
              <GameCover uri={hero.cover_url} width="100%" height={168} radius={0} style={{ borderTopLeftRadius: ED.radius, borderTopRightRadius: ED.radius }} />

              {/* Title block */}
              <View style={styles.heroBody}>
                <View style={styles.heroTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.heroTitle} numberOfLines={1}>{hero.title}</Text>
                    <View style={styles.heroMeta}>
                      <View style={edStyles.pill}>
                        <Text style={edStyles.pillText}>{hero.platform.toUpperCase()}</Text>
                      </View>
                      {hero.genre_names && (
                        <Text style={[styles.metaText, { color: ED.ink3 }]}>
                          · {hero.genre_names.split(',')[0]}
                        </Text>
                      )}
                    </View>
                  </View>
                  <Text style={styles.heroPercent}>
                    {hero.progress_percentage}
                    <Text style={{ fontSize: 14, color: ED.ink3 }}>%</Text>
                  </Text>
                </View>

                <View style={[edStyles.progressBar, { marginTop: 14 }]}>
                  <View style={[edStyles.progressFill, { width: `${hero.progress_percentage}%` as any }]} />
                </View>

                <View style={styles.heroStats}>
                  <Text style={[edStyles.eyebrow, { color: ED.ink3 }]}>
                    <Text style={{ fontFamily: MONO_FONT, color: ED.ink2 }}>
                      {Math.round(hero.playtime_minutes / 60)}h
                    </Text>
                    {' '}{language === 'es' ? 'jugadas' : 'played'}
                    {hero.hltb_main_story ? ` · ${Math.round(Math.max(0, hero.hltb_main_story - hero.playtime_minutes / 60))}h ${language === 'es' ? 'restantes' : 'left'}` : ''}
                  </Text>
                  {hero.hltb_main_story && (
                    <Text style={[edStyles.eyebrow, { color: ED.ink4 }]}>
                      HLTB <Text style={{ fontFamily: MONO_FONT, color: ED.ink3 }}>{hero.hltb_main_story}h</Text>
                    </Text>
                  )}
                </View>
              </View>

              {/* Session CTA */}
              <View style={styles.heroCta}>
                <TouchableOpacity
                  style={[edStyles.btn, edStyles.btnPrimary, { flex: 1, height: 50 }]}
                  onPress={() => setTimerGame(hero)}
                >
                  <Ionicons name="play" size={16} color="#1A1108" />
                  <Text style={[edStyles.btnText, edStyles.btnPrimaryText]}>
                    {language === 'es' ? 'Empezar sesión' : 'Start session'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={[edStyles.btn, { width: 50, height: 50 }]}>
                  <Ionicons name="bookmark-outline" size={18} color={ED.ink2} />
                </TouchableOpacity>
              </View>
              {hero.last_played && (
                <View style={styles.lastPlayed}>
                  <Text style={[edStyles.eyebrow, { color: ED.ink3, flex: 1 }]}>
                    {language === 'es' ? 'Última sesión' : 'Last session'} ·{' '}
                    {new Date(hero.last_played).toLocaleDateString()}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Second playing — compact */}
            {playing[1] && (
              <TouchableOpacity
                style={[edStyles.card, styles.compactCard]}
                onPress={() => router.push(`/game/${playing[1].id}`)}
              >
                <GameCover uri={playing[1].cover_url} width={48} height={64} radius={6} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.compactTitle} numberOfLines={1}>{playing[1].title}</Text>
                  <Text style={[edStyles.eyebrow, { color: ED.ink3, marginTop: 4 }]}>
                    <Text style={{ fontFamily: MONO_FONT }}>{playing[1].progress_percentage}%</Text>
                    {' '}· {language === 'es' ? 'último hace 5 días' : 'last played 5d ago'}
                  </Text>
                  <View style={[edStyles.progressBar, { marginTop: 6 }]}>
                    <View style={[edStyles.progressFill, { width: `${playing[1].progress_percentage}%` as any }]} />
                  </View>
                </View>
                <Ionicons name="play-outline" size={18} color={ED.copper} />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          /* Empty state */
          <View style={[edStyles.card, styles.emptyHero]}>
            <Ionicons name="game-controller-outline" size={36} color={ED.ink4} />
            <Text style={[styles.emptyTitle, { color: ED.ink2 }]}>
              {language === 'es' ? 'Sin juegos activos' : 'No active games'}
            </Text>
            <Text style={[edStyles.eyebrow, { color: ED.ink3, textAlign: 'center', marginTop: 4 }]}>
              {language === 'es' ? 'Mueve un juego a "Jugando" para empezar' : 'Move a game to "Playing" to get started'}
            </Text>
          </View>
        )}

        {/* ── Backlog Snapshot ────────────────────────────────── */}
        {stats && (
          <View style={styles.section}>
            <View style={edStyles.sectionHead}>
              <Text style={edStyles.eyebrow}>{language === 'es' ? 'El Backlog' : 'The Backlog'}</Text>
              <Text style={[edStyles.eyebrow, { color: ED.ink4 }]}>SNAPSHOT</Text>
            </View>
            <View style={styles.snapshotGrid}>
              {[
                { k: language === 'es' ? 'Total' : 'Total', v: stats.total.toString(), d: language === 'es' ? 'juegos' : 'games' },
                { k: language === 'es' ? 'Horas restantes' : 'Hours left', v: stats.total_hours_remaining > 999 ? `${(stats.total_hours_remaining / 1000).toFixed(1)}k` : stats.total_hours_remaining.toString(), d: language === 'es' ? 'estimadas' : 'estimated' },
                { k: language === 'es' ? 'Completados' : 'Completed', v: stats.completed.toString(), d: `${Math.round((stats.completed / Math.max(1, stats.total)) * 100)}%` },
                { k: language === 'es' ? 'En progreso' : 'In flight', v: (stats.playing + stats.paused).toString(), d: language === 'es' ? 'activos + pausados' : 'active + paused' },
              ].map((s, i) => (
                <View key={i} style={styles.snapshotCell}>
                  <Text style={[edStyles.eyebrow, { marginBottom: 8 }]}>{s.k}</Text>
                  <Text style={styles.snapshotNum}>{s.v}</Text>
                  <Text style={styles.snapshotSub}>{s.d}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Daily Pick ──────────────────────────────────────── */}
        {dailyPick && (
          <View style={styles.section}>
            <View style={edStyles.sectionHead}>
              <Text style={[edStyles.eyebrow, { color: ED.copper }]}>◆ {language === 'es' ? 'Pick del día' : 'Daily Pick'}</Text>
              <Text style={[edStyles.eyebrow, { color: ED.ink4 }]}>
                AI · {dailyPick.recommendation.match}% MATCH
              </Text>
            </View>
            <TouchableOpacity
              style={[edStyles.card, styles.pickCard]}
              onPress={() => router.push(`/game/${dailyPick.recommendation.game.id}`)}
              activeOpacity={0.88}
            >
              <GameCover uri={dailyPick.recommendation.game.cover_url} width={80} height={110} radius={8} />
              <View style={{ flex: 1, justifyContent: 'space-between' }}>
                <View>
                  <Text style={styles.pickTitle} numberOfLines={2}>{dailyPick.recommendation.game.title}</Text>
                  <Text style={styles.pickReason} numberOfLines={2}>{dailyPick.recommendation.reason}</Text>
                </View>
                <View style={styles.pickChips}>
                  {dailyPick.recommendation.badges.slice(0, 2).map(b => (
                    <View key={b} style={edStyles.chip}>
                      <Text style={edStyles.chipText}>{b}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Up Next ─────────────────────────────────────────── */}
        {upNext.length > 0 && (
          <View style={styles.section}>
            <View style={edStyles.sectionHead}>
              <Text style={edStyles.eyebrow}>{language === 'es' ? 'Próximos' : 'Up Next'}</Text>
              <Text style={[styles.seeAll, { color: ED.ink3 }]}>
                {language === 'es' ? 'Ver todos →' : 'See all →'}
              </Text>
            </View>
            <View style={styles.listContainer}>
              {upNext.map((g, i) => (
                <TouchableOpacity
                  key={g.id}
                  style={[styles.listRow, i < upNext.length - 1 && styles.listRowBorder]}
                  onPress={() => router.push(`/game/${g.id}`)}
                  activeOpacity={0.85}
                >
                  <Text style={[edStyles.eyebrow, { color: ED.ink4, width: 22 }]}>
                    {(i + 1).toString().padStart(2, '0')}
                  </Text>
                  <GameCover uri={g.cover_url} width={38} height={52} radius={4} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listTitle} numberOfLines={1}>{g.title}</Text>
                    <View style={styles.listMeta}>
                      {g.hltb_main_story && (
                        <Text style={[edStyles.eyebrow, { color: ED.ink3 }]}>
                          <Text style={{ fontFamily: MONO_FONT }}>{g.hltb_main_story}h</Text>
                        </Text>
                      )}
                      <Text style={[edStyles.eyebrow, { color: ED.ink3 }]}>· {g.platform.toUpperCase()}</Text>
                      <Text style={[edStyles.eyebrow, { color: g.priority === 'high' ? ED.rust : ED.ink4 }]}>
                        · {g.priority === 'high' ? '↑ High' : g.priority === 'medium' ? '→ Med' : '↓ Low'}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={ED.ink4} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── Paused — pick back up ───────────────────────────── */}
        {paused.length > 0 && (
          <View style={[styles.section, { marginBottom: 40 }]}>
            <View style={edStyles.sectionHead}>
              <Text style={[edStyles.eyebrow, { color: ED.amber }]}>
                {language === 'es' ? 'Pausados — ¿retomamos?' : 'Paused — pick back up?'}
              </Text>
              <Text style={[edStyles.eyebrow, { color: ED.ink4 }]}>{paused.length}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pausedScroll}>
              {paused.map((g, i) => (
                <TouchableOpacity
                  key={g.id}
                  style={styles.pausedItem}
                  onPress={() => router.push(`/game/${g.id}`)}
                >
                  <GameCover uri={g.cover_url} width={140} height={84} radius={8} />
                  <Text style={styles.pausedTitle} numberOfLines={1}>{g.title}</Text>
                  <View style={[edStyles.progressBar, { marginTop: 6 }]}>
                    <View style={[edStyles.progressFill, { width: `${g.progress_percentage}%` as any }]} />
                  </View>
                  <Text style={[edStyles.eyebrow, { color: ED.ink3, marginTop: 4 }]}>
                    <Text style={{ fontFamily: MONO_FONT }}>{g.progress_percentage}%</Text>
                    {' '}· <Text style={{ fontFamily: MONO_FONT }}>{Math.round(g.playtime_minutes / 60)}h</Text>
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Empty state when no games at all */}
        {games.length === 0 && (
          <View style={styles.emptyFull}>
            <View style={styles.emptyIconRing}>
              <Ionicons name="library-outline" size={32} color={ED.copper} />
            </View>
            <Text style={[edStyles.eyebrow, { color: ED.copper, marginTop: 12 }]}>
              ◆ READY WHEN YOU ARE
            </Text>
            <Text style={styles.emptyFullTitle}>{t('dash_empty_title', language)}</Text>
            <Text style={styles.emptyFullSub}>
              {t('dash_empty_text', language)}
            </Text>

            <TouchableOpacity
              style={styles.emptyCta}
              onPress={() => router.push('/(tabs)/settings' as any)}
              activeOpacity={0.85}
            >
              <Ionicons name="cloud-download-outline" size={16} color="#1A1108" />
              <Text style={styles.emptyCtaText}>Import library</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.emptyCtaGhost}
              onPress={() => router.push('/(tabs)/library' as any)}
              activeOpacity={0.85}
            >
              <Ionicons name="add-outline" size={15} color={ED.ink2} />
              <Text style={styles.emptyCtaGhostText}>Add a game manually</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <PickNextGameModal
        visible={modalVisible}
        recommendation={recommendation}
        onReroll={reroll}
        onClose={() => setModalVisible(false)}
      />

      {timerGame && (
        <SessionTimerModal
          visible={!!timerGame}
          game={timerGame}
          onClose={(savedMinutes) => {
            setTimerGame(null);
            if (savedMinutes) refresh();
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ED.bg },
  scroll: { paddingTop: 60, paddingHorizontal: 20 },

  // Header
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 },
  dateLabel: { marginBottom: 4 },
  greeting: { fontSize: 26, fontWeight: '800', letterSpacing: -0.8, color: ED.ink },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: ED.surface2, borderWidth: 1, borderColor: ED.line },

  // Section
  section: { marginBottom: 28 },

  // Currently playing
  nowPlayingLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  heroBody: { padding: 18, paddingBottom: 0 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  heroTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.6, color: ED.ink, lineHeight: 25, marginBottom: 6 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12, color: ED.ink3 },
  heroPercent: { fontSize: 26, fontWeight: '800', letterSpacing: -0.8, color: ED.copper },
  heroStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  heroCta: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: ED.line, marginTop: 14 },
  lastPlayed: { paddingHorizontal: 16, paddingBottom: 12 },

  // Compact playing card
  compactCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginTop: 8 },
  compactTitle: { fontSize: 14, fontWeight: '700', letterSpacing: -0.3, color: ED.ink },

  // Empty hero
  emptyHero: { alignItems: 'center', padding: 32, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },

  // Snapshot grid
  snapshotGrid: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: ED.line, borderRadius: ED.radius, overflow: 'hidden' },
  snapshotCell: { width: '50%', backgroundColor: ED.surface1, padding: 16, borderRightWidth: 1, borderBottomWidth: 1, borderColor: ED.line },
  snapshotNum: { fontWeight: '800', fontSize: 30, letterSpacing: -1, color: ED.ink, lineHeight: 34, marginBottom: 2 },
  snapshotSub: { fontSize: 10, color: ED.ink3 },

  // Daily pick
  pickCard: { flexDirection: 'row', gap: 14, padding: 14 },
  pickTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.4, color: ED.ink, marginBottom: 4 },
  pickReason: { fontSize: 12, color: ED.ink2, lineHeight: 18 },
  pickChips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 8 },

  // Up next list
  listContainer: { borderWidth: 1, borderColor: ED.line, borderRadius: ED.radius, overflow: 'hidden', backgroundColor: ED.surface1 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: ED.surface1 },
  listRowBorder: { borderBottomWidth: 1, borderBottomColor: ED.line },
  listTitle: { fontSize: 14, fontWeight: '600', letterSpacing: -0.2, color: ED.ink, marginBottom: 3 },
  listMeta: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  seeAll: { fontSize: 12, color: ED.ink3 },

  // Paused
  pausedScroll: { marginHorizontal: -20 },
  pausedItem: { marginLeft: 20, width: 140 },
  pausedTitle: { fontSize: 13, fontWeight: '600', letterSpacing: -0.2, color: ED.ink, marginTop: 8 },

  // Empty full
  emptyFull: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 12, gap: 10 },
  emptyIconRing: {
    width: 78, height: 78, borderRadius: 22,
    backgroundColor: ED.copperBg, borderWidth: 1, borderColor: ED.copperLine,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyFullTitle: {
    fontSize: 26, fontWeight: '800', color: ED.ink,
    letterSpacing: -0.8, textAlign: 'center', marginTop: 2,
  },
  emptyFullSub: {
    fontSize: 13, color: ED.ink3, textAlign: 'center',
    lineHeight: 20, maxWidth: 280, marginTop: 2, marginBottom: 16,
  },
  emptyCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 50, borderRadius: 14,
    backgroundColor: ED.copper, paddingHorizontal: 24, minWidth: 240,
  },
  emptyCtaText: { fontSize: 15, fontWeight: '700', color: '#1A1108' },
  emptyCtaGhost: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, height: 42, paddingHorizontal: 16,
  },
  emptyCtaGhostText: { fontSize: 13, fontWeight: '600', color: ED.ink2 },
});
