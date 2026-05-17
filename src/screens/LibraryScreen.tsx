import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, ScrollView, StyleSheet, TextInput,
  TouchableOpacity, StatusBar, Platform, UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useGames } from '../hooks/useGames';
import { useAppContext } from '../hooks/useAppContext';
import { GameCover } from '../components/GameCover';
import { ManualGameModal } from '../components/ManualGameModal';
import { Game, GameStatus, Platform as GamePlatform } from '../types';
import { priorityWeight } from '../utils/formatters';
import { ED, edStyles, STATUS_COLORS, PRIORITY_COLORS, MONO_FONT } from '../styles/editorial';
import { t, Language } from '../i18n';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type PlatformMode = 'all' | GamePlatform;
type SortMode = 'priority_high' | 'priority_low' | 'hltb_met' | 'shortest' | 'longest' | 'recently_played' | 'least_recently_played' | 'alphabetical_asc' | 'alphabetical_desc';
type ShortMode = 'all' | 'under_5' | 'under_10';
type ViewMode = 'grid' | 'list';

function getFilterTabs(lang: Language): { key: GameStatus | 'all'; label: string; count?: number }[] {
  return [
    { key: 'all', label: t('lib_tab_all', lang) },
    { key: 'playing', label: t('lib_tab_playing', lang) },
    { key: 'up_next', label: t('lib_tab_up_next', lang) },
    { key: 'paused', label: t('lib_tab_paused', lang) },
    { key: 'completed', label: t('lib_tab_completed', lang) },
    { key: 'abandoned', label: t('lib_tab_abandoned', lang) },
    { key: 'not_started', label: t('lib_tab_not_started', lang) },
  ];
}

function compareGames(a: Game, b: Game, mode: SortMode): number {
  switch (mode) {
    case 'priority_high': return priorityWeight(b.priority) - priorityWeight(a.priority) || a.title.localeCompare(b.title);
    case 'priority_low': return priorityWeight(a.priority) - priorityWeight(b.priority) || a.title.localeCompare(b.title);
    case 'shortest': return (a.hltb_main_story ?? Infinity) - (b.hltb_main_story ?? Infinity);
    case 'longest': return (b.hltb_main_story ?? 0) - (a.hltb_main_story ?? 0);
    case 'recently_played': {
      const da = a.last_played ? new Date(a.last_played).getTime() : 0;
      const db = b.last_played ? new Date(b.last_played).getTime() : 0;
      return db - da;
    }
    case 'alphabetical_asc': return a.title.localeCompare(b.title);
    case 'alphabetical_desc': return b.title.localeCompare(a.title);
    default: return 0;
  }
}

export default function LibraryScreen() {
  const router = useRouter();
  const { language } = useAppContext();
  const { games, stats, refresh, search, setStatus } = useGames();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<GameStatus | 'all'>('all');
  const [sortMode, setSortMode] = useState<SortMode>('priority_high');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [showSort, setShowSort] = useState(false);

  const FILTER_TABS = getFilterTabs(language);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const filtered: Game[] = (() => {
    let list = query.trim() ? search(query) : games;
    if (filter !== 'all') list = list.filter(g => g.status === filter);
    return [...list].sort((a, b) => compareGames(a, b, sortMode));
  })();

  const SORT_OPTIONS: { key: SortMode; label: string }[] = [
    { key: 'priority_high', label: language === 'es' ? 'Prioridad ↑' : 'Priority ↑' },
    { key: 'shortest', label: language === 'es' ? 'Más cortos' : 'Shortest' },
    { key: 'longest', label: language === 'es' ? 'Más largos' : 'Longest' },
    { key: 'recently_played', label: language === 'es' ? 'Recientes' : 'Recent' },
    { key: 'alphabetical_asc', label: 'A–Z' },
  ];

  const renderGridItem = ({ item, index }: { item: Game; index: number }) => {
    const sc = STATUS_COLORS[item.status];
    return (
      <TouchableOpacity
        style={styles.gridItem}
        onPress={() => router.push(`/game/${item.id}`)}
        activeOpacity={0.85}
      >
        <View style={{ position: 'relative' }}>
          <GameCover uri={item.cover_url} width="100%" height={150} radius={8} />
          {item.status === 'playing' && (
            <View style={styles.playingBadge}>
              <View style={[styles.playingDot, { backgroundColor: ED.moss }]} />
              <Text style={styles.playingBadgeText}>PLAYING</Text>
            </View>
          )}
          {item.status === 'completed' && (
            <View style={styles.completedBadge}>
              <Ionicons name="checkmark" size={10} color={ED.plum} />
            </View>
          )}
          {item.priority === 'high' && item.status !== 'completed' && (
            <View style={styles.priorityBadge}>
              <Text style={styles.priorityBadgeText}>↑ HIGH</Text>
            </View>
          )}
        </View>
        <View style={{ marginTop: 8 }}>
          <Text style={styles.gridTitle} numberOfLines={2}>{item.title}</Text>
          <View style={styles.gridMeta}>
            {item.hltb_main_story !== null && (
              <Text style={[edStyles.eyebrow, { color: ED.ink3 }]}>
                {item.hltb_main_story}h
              </Text>
            )}
            {item.progress_percentage > 0 && item.progress_percentage < 100 && (
              <Text style={[edStyles.eyebrow, { color: ED.copper }]}>
                {item.progress_percentage}%
              </Text>
            )}
          </View>
          {item.progress_percentage > 0 && item.progress_percentage < 100 && (
            <View style={[edStyles.progressBar, { height: 2, marginTop: 4 }]}>
              <View style={[edStyles.progressFill, { width: `${item.progress_percentage}%` as any }]} />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderListItem = ({ item }: { item: Game }) => {
    const sc = STATUS_COLORS[item.status];
    return (
      <TouchableOpacity
        style={styles.listItem}
        onPress={() => router.push(`/game/${item.id}`)}
        activeOpacity={0.85}
      >
        <GameCover uri={item.cover_url} width={48} height={64} radius={6} />
        <View style={{ flex: 1 }}>
          <Text style={styles.listTitle} numberOfLines={1}>{item.title}</Text>
          <View style={styles.listMetaRow}>
            <View style={[edStyles.chip, { paddingHorizontal: 7, paddingVertical: 3 }]}>
              <Text style={[edStyles.chipText, { color: sc.color, fontSize: 10 }]}>{sc.label}</Text>
            </View>
            {item.hltb_main_story !== null && (
              <Text style={[edStyles.eyebrow, { color: ED.ink3 }]}>
                <Text style={{ fontFamily: MONO_FONT }}>{item.hltb_main_story}</Text>h
              </Text>
            )}
            <Text style={[edStyles.eyebrow, { color: ED.ink4 }]}>{item.platform.toUpperCase()}</Text>
          </View>
          {item.progress_percentage > 0 && item.progress_percentage < 100 && (
            <View style={[edStyles.progressBar, { marginTop: 6 }]}>
              <View style={[edStyles.progressFill, { width: `${item.progress_percentage}%` as any }]} />
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={14} color={ED.ink4} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* ── Header ──────────────────────────────────────── */}
      <View style={styles.headerWrap}>
        <View style={styles.titleRow}>
          <View>
            <Text style={[edStyles.eyebrow, { marginBottom: 4 }]}>
              {filtered.length} {language === 'es' ? 'títulos' : 'titles'} · {stats ? `${stats.total_hours_remaining}h` : '—'} {language === 'es' ? 'para terminar' : 'to clear'}
            </Text>
            <Text style={styles.title}>{t('lib_title', language)}</Text>
          </View>
          <View style={styles.titleActions}>
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}
              onPress={() => setViewMode('list')}
            >
              <Ionicons name="list-outline" size={14} color={viewMode === 'list' ? ED.bg : ED.ink2} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === 'grid' && styles.viewToggleBtnActive]}
              onPress={() => setViewMode('grid')}
            >
              <Ionicons name="grid-outline" size={14} color={viewMode === 'grid' ? ED.bg : ED.ink2} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={15} color={ED.ink3} />
            <TextInput
              style={styles.searchInput}
              placeholder={language === 'es' ? 'Buscar títulos, géneros…' : 'Search titles, genres…'}
              placeholderTextColor={ED.ink3}
              value={query}
              onChangeText={setQuery}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={15} color={ED.ink3} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[styles.sortBtn, showSort && { backgroundColor: ED.copper, borderColor: ED.copper }]}
            onPress={() => setShowSort(v => !v)}
          >
            <Ionicons name="swap-vertical-outline" size={16} color={showSort ? '#1A1108' : ED.ink2} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortBtn, { backgroundColor: ED.copper, borderColor: ED.copper }]}
            onPress={() => setManualModalOpen(true)}
          >
            <Ionicons name="add" size={18} color="#1A1108" />
          </TouchableOpacity>
        </View>

        {/* Sort dropdown */}
        {showSort && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortScroll}>
            {SORT_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.sortChip, sortMode === opt.key && styles.sortChipActive]}
                onPress={() => { setSortMode(opt.key); setShowSort(false); }}
              >
                <Text style={[styles.sortChipText, sortMode === opt.key && { color: ED.bg }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Status filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {FILTER_TABS.map(tab => {
            const active = filter === tab.key;
            const count = tab.key === 'all' ? games.length : games.filter(g => g.status === tab.key).length;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setFilter(tab.key)}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {tab.label}
                </Text>
                <Text style={[styles.filterCount, active && { color: ED.bg }]}>
                  {count}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Results header */}
        <View style={[edStyles.sectionHead, { marginBottom: 8, paddingBottom: 0 }]}>
          <Text style={edStyles.eyebrow}>
            {filter === 'all' ? 'A–Z' : STATUS_COLORS[filter as GameStatus]?.label || filter} · {filtered.length} {language === 'es' ? 'resultados' : 'results'}
          </Text>
          <Text style={[edStyles.eyebrow, { color: ED.ink4 }]}>
            {language === 'es' ? 'SORT' : 'SORT'} ▾ {SORT_OPTIONS.find(s => s.key === sortMode)?.label}
          </Text>
        </View>
      </View>

      {/* ── Games list/grid ──────────────────────────── */}
      {viewMode === 'grid' ? (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          numColumns={3}
          renderItem={renderGridItem}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          ListEmptyComponent={<EmptyState query={query} language={language} />}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          renderItem={renderListItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={edStyles.divider} />}
          ListEmptyComponent={<EmptyState query={query} language={language} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      <ManualGameModal
        visible={manualModalOpen}
        onClose={() => setManualModalOpen(false)}
        onGameAdded={() => refresh()}
      />
    </View>
  );
}

function EmptyState({ query, language }: { query: string; language: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name="game-controller-outline" size={44} color={ED.ink4} />
      <Text style={styles.emptyTitle}>{language === 'es' ? 'Sin juegos' : 'No games'}</Text>
      <Text style={[edStyles.eyebrow, { color: ED.ink3, textAlign: 'center', marginTop: 4 }]}>
        {query
          ? language === 'es' ? 'Sin resultados para esa búsqueda' : 'No results for that search'
          : language === 'es' ? 'Importa juegos o agrega uno manualmente' : 'Import games or add one manually'
        }
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ED.bg },
  headerWrap: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 8, backgroundColor: ED.bg },

  // Header
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontSize: 36, fontWeight: '800', letterSpacing: -1.5, color: ED.ink },
  titleActions: { flexDirection: 'row', gap: 4, paddingBottom: 4 },
  viewToggleBtn: { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: ED.surface2, borderWidth: 1, borderColor: ED.line },
  viewToggleBtnActive: { backgroundColor: ED.ink, borderColor: ED.ink },

  // Search
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 42, borderRadius: 12, backgroundColor: ED.surface1, borderWidth: 1, borderColor: ED.line },
  searchInput: { flex: 1, color: ED.ink, fontSize: 14, fontWeight: '400' },
  sortBtn: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: ED.surface2, borderWidth: 1, borderColor: ED.line },

  // Sort
  sortScroll: { marginBottom: 10 },
  sortChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, backgroundColor: ED.surface2, borderWidth: 1, borderColor: ED.line, marginRight: 6 },
  sortChipActive: { backgroundColor: ED.ink, borderColor: ED.ink },
  sortChipText: { fontSize: 12, fontWeight: '600', color: ED.ink2 },

  // Filter chips
  filterScroll: { marginBottom: 12 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 28, paddingHorizontal: 12, borderRadius: 100, backgroundColor: ED.surface2, borderWidth: 1, borderColor: ED.line, marginRight: 6 },
  filterChipActive: { backgroundColor: ED.ink, borderColor: ED.ink },
  filterChipText: { fontSize: 11, fontWeight: '500', color: ED.ink2 },
  filterChipTextActive: { color: ED.bg },
  filterCount: { fontFamily: MONO_FONT, fontSize: 10, color: ED.ink3, opacity: 0.7 },

  // Grid
  gridContent: { paddingHorizontal: 16, paddingBottom: 120 },
  gridRow: { gap: 10, marginBottom: 18 },
  gridItem: { flex: 1 },
  gridTitle: { fontSize: 12, fontWeight: '600', letterSpacing: -0.2, color: ED.ink, lineHeight: 16 },
  gridMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },

  // Grid badges
  playingBadge: { position: 'absolute', top: 5, left: 5, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 5, paddingVertical: 2, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4 },
  playingDot: { width: 5, height: 5, borderRadius: 3 },
  playingBadgeText: { fontFamily: MONO_FONT, fontSize: 8, fontWeight: '600', color: ED.moss, letterSpacing: 0.4 },
  completedBadge: { position: 'absolute', top: 5, right: 5, width: 18, height: 18, borderRadius: 9, backgroundColor: ED.plumBg, alignItems: 'center', justifyContent: 'center' },
  priorityBadge: { position: 'absolute', top: 5, right: 5, paddingHorizontal: 5, paddingVertical: 2, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4 },
  priorityBadgeText: { fontFamily: MONO_FONT, fontSize: 8, fontWeight: '600', color: ED.rust, letterSpacing: 0.4 },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 120 },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, backgroundColor: ED.bg },
  listTitle: { fontSize: 14, fontWeight: '600', letterSpacing: -0.2, color: ED.ink, marginBottom: 5 },
  listMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  // Empty
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: ED.ink },
});
