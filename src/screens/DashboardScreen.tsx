import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useGames } from '../../src/hooks/useGames';
import { useRecommendation } from '../../src/hooks/useRecommendation';
import { GameCard } from '../../src/components/GameCard';
import { GameCover } from '../../src/components/GameCover';
import { StatCard } from '../../src/components/StatCard';
import { SectionHeader } from '../../src/components/SectionHeader';
import { PickNextGameModal } from '../../src/components/PickNextGameModal';
import { GlassCard } from '../../src/components/GlassCard';
import { formatBacklogHours } from '../../src/utils/formatters';
import { useAppContext } from '../../src/hooks/useAppContext';
import { getDailyPick, getRecommendations, getRecentCompletionCelebration } from '../../src/services/recommendationService';
import { useRouter } from 'expo-router';
import { CompletionCelebration, DailyPick, Game, Recommendation } from '../../src/types';
import { t } from '../../src/i18n';
import { SessionTimerModal } from '../../src/components/SessionTimerModal';


export default function DashboardScreen() {
  const router = useRouter();
  const { games, stats, refresh, setStatus, getByStatus } = useGames();
  const { recommendation, refresh: refreshRec, reroll } = useRecommendation();
  const { themeColors, language, playerName } = useAppContext();
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [timerGame, setTimerGame] = useState<Game | null>(null);
  const [topRecs, setTopRecs] = useState<Recommendation[]>([]);
  const [dailyPick, setDailyPick] = useState<DailyPick | null>(null);
  const [celebration, setCelebration] = useState<CompletionCelebration | null>(null);

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshRec();
      setDailyPick(getDailyPick());
      setCelebration(getRecentCompletionCelebration());
      setTopRecs(getRecommendations({ limit: 3 }));
    }, [refresh, refreshRec])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    refresh();
    setRefreshing(false);
  };

  const playing = getByStatus('playing');
  const upNext = getByStatus('up_next');
  const paused = getByStatus('paused');

  return (
    <View style={[styles.root, { backgroundColor: themeColors.bg }]}>
      <StatusBar barStyle="light-content" />

      {/* Hero gradient background */}
      <LinearGradient
        colors={[themeColors.bg, themeColors.card]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 0.5 }}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={themeColors.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: themeColors.textPrimary }]}>
              {t('dash_greeting', language)} {playerName || t('dash_greeting_default', language)}
            </Text>
            <Text style={[styles.subtitle, { color: themeColors.textMuted }]}>
              {stats
                ? `${stats.total} ${t('dash_subtitle_games', language)} · ${formatBacklogHours(stats.total_hours_remaining)} ${t('dash_subtitle_remaining', language)}`
                : t('dash_loading', language)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              style={styles.pickBtn}
              onPress={() => router.push('/share' as any)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[themeColors.teal, themeColors.blue]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="share-social" size={18} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.pickBtn}
              onPress={() => setModalVisible(true)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[themeColors.accent, themeColors.violet]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="dice" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Backlog countdown banner */}
        {stats && stats.total_hours_remaining > 0 && (
          <View style={[styles.banner, { borderColor: themeColors.glassBorder }]}>
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={[themeColors.accent + '22', themeColors.orange + '10']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name="hourglass-outline" size={20} color={themeColors.orange} />
            <Text style={[styles.bannerText, { color: themeColors.textSecondary }]}>
              {t('dash_backlog_banner', language)}{' '}
              <Text style={{ color: themeColors.orange, fontWeight: '800' }}>
                {formatBacklogHours(stats.total_hours_remaining)}
              </Text>{' '}
              {t('dash_backlog_banner2', language)}
            </Text>
          </View>
        )}

        {/* --- Premium Widget Top Row --- */}
        {dailyPick && (
          <View style={styles.section}>
            <SectionHeader title={t('dash_daily_pick', language)} icon="flash" iconColor={themeColors.teal} />
            <TouchableOpacity onPress={() => router.push(`/game/${dailyPick.recommendation.game.id}`)} activeOpacity={0.82}>
              <GlassCard padding={16} radius={18} borderColor={themeColors.teal} intensity={26} style={{ overflow: 'hidden' }}>
                <LinearGradient
                  colors={[themeColors.teal + '22', themeColors.blue + '12']}
                  style={StyleSheet.absoluteFill}
                />
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <GameCover uri={dailyPick.recommendation.game.cover_url} width={92} height={58} radius={12} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.recTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
                      {dailyPick.recommendation.game.title}
                    </Text>
                    <Text style={[styles.recReason, { color: themeColors.textSecondary }]} numberOfLines={2}>
                      {dailyPick.recommendation.reason}
                    </Text>
                    <Text style={[styles.dailyMeta, { color: themeColors.teal }]}>
                      {dailyPick.subtitle}
                    </Text>
                  </View>
                </View>
              </GlassCard>
            </TouchableOpacity>
          </View>
        )}

        {celebration && (
          <View style={styles.section}>
            <SectionHeader title={t('dash_recent_win', language)} icon="trophy" iconColor={themeColors.orange} />
            <GlassCard padding={18} radius={18} style={{ overflow: 'hidden' }}>
              <LinearGradient
                colors={[themeColors.orange + '20', themeColors.accent + '12']}
                style={StyleSheet.absoluteFill}
              />
              <Text style={[styles.celebrationTitle, { color: themeColors.textPrimary }]}>
                {celebration.title} completed
              </Text>
              <Text style={[styles.celebrationText, { color: themeColors.textSecondary }]}>
                {t('dash_shaved', language)} {celebration.savedHours}h {t('dash_off_backlog', language)} {celebration.completedCount} {t('dash_completed_games', language)}
              </Text>
            </GlassCard>
          </View>
        )}

        {topRecs.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title={t('dash_ai_next', language)} icon="sparkles" iconColor={themeColors.orange} />
            <TouchableOpacity onPress={() => router.push(`/game/${topRecs[0].game.id}`)} activeOpacity={0.8} style={{ position: 'relative', marginTop: 12 }}>
              <View style={[styles.premiumBadgeRow, { backgroundColor: themeColors.accent, zIndex: 10 }]}>
                <Text style={styles.premiumBadgeText}>Match {topRecs[0].match}%</Text>
              </View>
              <GlassCard padding={16} radius={16} borderColor={themeColors.accent} intensity={30}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <GameCover uri={topRecs[0].game.cover_url} width={80} height={110} radius={12} />
                  <View style={{ flex: 1, justifyContent: 'center' }}>
                    <Text style={[styles.recTitle, { color: themeColors.textPrimary }]} numberOfLines={2}>
                      {topRecs[0].game.title}
                    </Text>
                    <Text style={[styles.recReason, { color: themeColors.textSecondary }]}>
                      {topRecs[0].reason}
                    </Text>
                  </View>
                </View>
              </GlassCard>
            </TouchableOpacity>
          </View>
        )}

        {/* Stats grid */}
        {stats && (
          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <StatCard
                label={t('stat_total', language)}
                value={stats.total}
                icon="library"
                color={themeColors.accent}
              />
              <StatCard
                label={t('stat_playing', language)}
                value={stats.playing}
                icon="play-circle"
                color={themeColors.green}
              />
            </View>
            <View style={styles.statsRow}>
              <StatCard
                label={t('stat_up_next', language)}
                value={stats.up_next}
                icon="bookmark"
                color={themeColors.blue}
              />
              <StatCard
                label={t('stat_hltb_met', language)}
                value={stats.hltb_target_met}
                icon="checkmark-done-circle"
                color={themeColors.orange}
                subtitle={`${stats.completed} ${t('stat_completed', language)}`}
              />
            </View>
          </View>
        )}

        {/* Currently Playing */}
        {playing.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title={t('dash_currently_playing', language)}
              icon="play-circle"
              iconColor={themeColors.green}
              count={playing.length}
            />
            {playing.map((g) => (
              <View key={g.id}>
                <GameCard
                  game={g}
                  onStatusChange={setStatus}
                />
                <TouchableOpacity
                  style={[styles.startPlayingBtn, { backgroundColor: themeColors.green }]}
                  onPress={() => setTimerGame(g)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="play-circle" size={18} color="#fff" />
                  <Text style={styles.startPlayingText}>
                    {language === 'es' ? '¡Empezar a Jugar!' : 'Start Playing!'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Up Next */}
        {upNext.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title={t('dash_up_next', language)}
              icon="bookmark"
              iconColor={themeColors.blue}
              count={upNext.length}
              action={{
                label: t('dash_see_all', language),
                onPress: () => { },
              }}
            />
            {upNext.slice(0, 5).map((g) => (
              <GameCard
                key={g.id}
                game={g}
                onStatusChange={setStatus}
              />
            ))}
          </View>
        )}

        {/* Paused */}
        {paused.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title={t('dash_paused', language)}
              icon="pause-circle"
              iconColor={themeColors.violet}
              count={paused.length}
            />
            {paused.slice(0, 3).map((g) => (
              <GameCard key={g.id} game={g} onStatusChange={setStatus} compact />
            ))}
          </View>
        )}

        {/* Empty state */}
        {games.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="cloud-download-outline" size={56} color={themeColors.textMuted} />
            <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>{t('dash_empty_title', language)}</Text>
            <Text style={[styles.emptyText, { color: themeColors.textMuted }]}>
              {t('dash_empty_text', language)}
            </Text>
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
  root: {
    flex: 1,
  },
  scroll: {
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 3,
  },
  pickBtn: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  banner: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    marginBottom: 20,
  },
  bannerText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  statsGrid: {
    gap: 10,
    marginBottom: 28,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  section: {
    marginBottom: 28,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  premiumBadgeRow: {
    position: 'absolute',
    top: -10,
    right: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 10,
    elevation: 5,
  },
  premiumBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  recTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  recReason: { fontSize: 12, lineHeight: 18 },
  dailyMeta: { fontSize: 12, fontWeight: '700', marginTop: 6 },
  celebrationTitle: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  celebrationText: { fontSize: 13, lineHeight: 20 },
  startPlayingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 44,
    borderRadius: 14,
    marginTop: 8,
    marginBottom: 4,
  },
  startPlayingText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});
