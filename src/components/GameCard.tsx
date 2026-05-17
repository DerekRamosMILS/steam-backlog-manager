import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Game, GameStatus, STATUS_CONFIG } from '../types';
import { GameCover } from './GameCover';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { PlatformBadge } from './PlatformBadge';
import {
  formatMinutes,
  formatHLTBTime,
  formatRemainingTime,
  getRemainingMinutes,
  truncate,
} from '../utils/formatters';
import { useAppContext } from '../hooks/useAppContext';
import { t } from '../i18n';
import { ED, STATUS_COLORS } from '../styles/editorial';

interface GameCardProps {
  game: Game;
  onStatusChange?: (id: number, status: GameStatus) => void;
  compact?: boolean;
}

const STATUS_CYCLE: GameStatus[] = [
  'not_started',
  'up_next',
  'playing',
  'paused',
  'completed',
  'abandoned',
];

export function GameCard({ game, onStatusChange, compact = false }: GameCardProps) {
  const { language } = useAppContext();
  const router = useRouter();
  const statusConfig = STATUS_CONFIG[game.status];
  const sc = STATUS_COLORS[game.status] ?? { color: ED.copper };

  const cycleStatus = useCallback(() => {
    const current = STATUS_CYCLE.indexOf(game.status);
    const next = STATUS_CYCLE[(current + 1) % STATUS_CYCLE.length];
    onStatusChange?.(game.id, next);
  }, [game.id, game.status, onStatusChange]);

  const openDetail = () => router.push(`/game/${game.id}`);
  const progressWidth = `${Math.min(100, game.progress_percentage)}%`;
  const remainingMinutes = getRemainingMinutes(game.hltb_main_story, game.playtime_minutes);

  if (compact) {
    return (
      <TouchableOpacity onPress={openDetail} activeOpacity={0.85} style={styles.compactWrapper}>
        <GameCover uri={game.cover_url} width={70} height={50} radius={8} />
        <View style={styles.compactInfo}>
          <Text style={styles.compactTitle} numberOfLines={1}>
            {truncate(game.title, 28)}
          </Text>
          <StatusBadge status={game.status} size="sm" />
        </View>
        <Ionicons name="chevron-forward" size={14} color={ED.ink3} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={openDetail} activeOpacity={0.85} style={styles.wrapper}>
      <View style={styles.row}>
        <GameCover uri={game.cover_url} width={96} height={56} radius={8} />

        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={2}>{game.title}</Text>

          <View style={styles.badges}>
            <StatusBadge status={game.status} size="sm" />
            <PriorityBadge priority={game.priority} size="sm" />
            {game.platform !== 'steam' && (
              <PlatformBadge platform={game.platform} size="sm" />
            )}
          </View>

          <View style={styles.meta}>
            {game.hltb_main_story ? (
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={11} color={ED.ink3} />
                <Text style={styles.metaText}>
                  {formatHLTBTime(game.hltb_main_story)}
                </Text>
              </View>
            ) : null}
            {game.playtime_minutes > 0 ? (
              <View style={styles.metaItem}>
                <Ionicons name="game-controller-outline" size={11} color={ED.ink3} />
                <Text style={styles.metaText}>
                  {formatMinutes(game.playtime_minutes)} {t('gc_played', language)}
                </Text>
              </View>
            ) : null}
            {remainingMinutes !== null ? (
              <View style={styles.metaItem}>
                <Ionicons name="hourglass-outline" size={11} color={ED.copper} />
                <Text style={[styles.metaText, { color: ED.copper }]}>
                  {formatRemainingTime(game.hltb_main_story, game.playtime_minutes)} {t('gc_left', language)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <TouchableOpacity
          onPress={cycleStatus}
          style={styles.statusBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View style={[styles.statusDot, { backgroundColor: sc.color + '22', borderColor: sc.color + '40' }]}>
            <Ionicons
              name={statusConfig.icon as keyof typeof Ionicons.glyphMap}
              size={14}
              color={sc.color}
            />
          </View>
        </TouchableOpacity>
      </View>

      {game.progress_percentage > 0 && (
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: progressWidth as any, backgroundColor: sc.color },
            ]}
          />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: ED.radius,
    borderWidth: 1,
    borderColor: ED.line,
    backgroundColor: ED.surface1,
    overflow: 'hidden',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    gap: 12,
  },
  info: { flex: 1, minWidth: 0, gap: 6 },
  title: {
    color: ED.ink,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 19,
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { color: ED.ink3, fontSize: 11 },
  statusBtn: {
    width: 38, height: 38,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  statusDot: {
    width: 36, height: 36, borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  progressTrack: {
    height: 3,
    backgroundColor: ED.surface3,
    marginHorizontal: 12, marginBottom: 10,
    borderRadius: 99, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 99, opacity: 0.9 },
  compactWrapper: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ED.line,
    backgroundColor: ED.surface1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 10,
    marginBottom: 8,
  },
  compactInfo: { flex: 1, gap: 4 },
  compactTitle: { color: ED.ink, fontSize: 13, fontWeight: '600' },
});
