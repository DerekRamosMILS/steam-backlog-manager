import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../hooks/useAppContext';
import { searchGamesByTitle } from '../services/gameSearchService';
import { insertManualGame } from '../database/queries';
import { ManualGameSearchResult, GameStatus, GamePriority, Platform as GamePlatform } from '../types';
import { t, Language } from '../i18n';
import { ED, edStyles, MONO_FONT, STATUS_COLORS } from '../styles/editorial';

interface Props {
  visible: boolean;
  onClose: () => void;
  onGameAdded: () => void;
}

const STATUS_OPTIONS: { key: GameStatus; label: string }[] = [
  { key: 'not_started', label: 'Not started' },
  { key: 'up_next', label: 'Up Next' },
  { key: 'playing', label: 'Playing' },
  { key: 'paused', label: 'Paused' },
];

const PRIORITY_OPTIONS: { key: GamePriority; label: string; color: string }[] = [
  { key: 'high', label: 'High', color: ED.rust },
  { key: 'medium', label: 'Med', color: ED.amber },
  { key: 'low', label: 'Low', color: ED.ink3 },
];

const PLATFORM_OPTIONS: { key: GamePlatform; label: string }[] = [
  { key: 'steam', label: 'Steam' },
  { key: 'gog', label: 'GOG' },
  { key: 'epic', label: 'Epic' },
  { key: 'playstation', label: 'PlayStation' },
  { key: 'xbox', label: 'Xbox' },
  { key: 'nintendo', label: 'Nintendo' },
  { key: 'other', label: 'Other' },
];

export function ManualGameModal({ visible, onClose, onGameAdded }: Props) {
  const { language } = useAppContext();
  const lang = language as Language;

  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState<GamePlatform>('other');
  const [status, setStatus] = useState<GameStatus>('not_started');
  const [priority, setPriority] = useState<GamePriority>('medium');
  const [notes, setNotes] = useState('');
  const [searchResults, setSearchResults] = useState<ManualGameSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedGame, setSelectedGame] = useState<ManualGameSearchResult | null>(null);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTitleChange = (text: string) => {
    setTitle(text);
    setSelectedGame(null);
    if (text.trim().length < 2) { setSearchResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const results = await searchGamesByTitle(text);
      setSearchResults(results);
      setSearching(false);
    }, 600);
  };

  const selectGame = (game: ManualGameSearchResult) => {
    setSelectedGame(game);
    setTitle(game.title);
    setSearchResults([]);
  };

  const reset = () => {
    setTitle(''); setPlatform('other'); setStatus('not_started'); setPriority('medium');
    setNotes(''); setSearchResults([]); setSelectedGame(null);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert(t('mgm_alert_title_req', lang), t('mgm_alert_title_msg', lang));
      return;
    }
    setSaving(true);
    try {
      insertManualGame({
        title: title.trim(),
        coverUrl: selectedGame?.coverUrl ?? '',
        platform,
        status,
        priority,
        notes: notes.trim(),
        releaseYear: selectedGame?.releaseYear ?? null,
        summary: selectedGame?.summary ?? null,
        genreNames: null,
        developerName: selectedGame?.developer ?? null,
        publisherName: null,
        externalId: selectedGame ? String(selectedGame.igdbId) : null,
        idSource: selectedGame ? 'steam' : 'manual',
      });
      onGameAdded();
      reset();
      onClose();
    } catch {
      Alert.alert(t('mgm_alert_error', lang), t('mgm_alert_error_msg', lang));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.root}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => { reset(); onClose(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={20} color={ED.ink3} />
          </TouchableOpacity>
          <Text style={edStyles.eyebrow}>ADD GAME</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {saving ? (
              <ActivityIndicator color={ED.copper} size="small" />
            ) : (
              <Text style={s.saveText}>{t('mgm_save', lang)}</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Title */}
          <View style={s.titleBlock}>
            <Text style={[edStyles.displayTitle, { fontSize: 30 }]}>Track any title.</Text>
            <Text style={s.titleSub}>Search IGDB or enter details manually.</Text>
          </View>

          {/* Search bar */}
          <View style={s.searchBar}>
            <Ionicons name="search-outline" size={16} color={searching ? ED.copper : ED.ink3} />
            <TextInput
              style={s.searchInput}
              placeholder={t('mgm_title_placeholder', lang)}
              placeholderTextColor={ED.ink4}
              value={title}
              onChangeText={handleTitleChange}
              autoCorrect={false}
            />
            {searching && <ActivityIndicator size="small" color={ED.copper} />}
          </View>

          {/* Search results */}
          {searchResults.length > 0 && (
            <View style={s.section}>
              <View style={edStyles.sectionHead}>
                <Text style={edStyles.eyebrow}>{searchResults.length} results from IGDB</Text>
              </View>
              <View style={edStyles.card}>
                {searchResults.map((game, idx) => (
                  <TouchableOpacity
                    key={game.igdbId}
                    style={[
                      s.resultRow,
                      idx < searchResults.length - 1 && { borderBottomWidth: 1, borderBottomColor: ED.line },
                      selectedGame?.igdbId === game.igdbId && s.resultRowSelected,
                    ]}
                    onPress={() => selectGame(game)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.resultTitle} numberOfLines={1}>{game.title}</Text>
                      <Text style={s.resultMeta}>
                        {[game.releaseYear, game.developer].filter(Boolean).join(' · ')}
                      </Text>
                      {game.platforms.length > 0 && (
                        <View style={{ flexDirection: 'row', gap: 4, marginTop: 5 }}>
                          {game.platforms.slice(0, 3).map(p => (
                            <View key={p} style={edStyles.pill}>
                              <Text style={edStyles.pillText}>{p}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                    {selectedGame?.igdbId === game.igdbId ? (
                      <Ionicons name="checkmark-circle" size={18} color={ED.copper} />
                    ) : (
                      <Ionicons name="chevron-forward" size={14} color={ED.ink3} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Divider */}
          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={edStyles.eyebrow}>OR ENTER MANUALLY</Text>
            <View style={s.dividerLine} />
          </View>

          {/* Platform */}
          <View style={s.section}>
            <Text style={s.fieldLabel}>{t('mgm_platform', lang)}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
              <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 4 }}>
                {PLATFORM_OPTIONS.map((opt) => {
                  const active = platform === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[s.optChip, active && s.optChipActive]}
                      onPress={() => setPlatform(opt.key)}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.optText, active && s.optTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          {/* Status + Priority row */}
          <View style={[s.section, { flexDirection: 'row', gap: 12 }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>{t('mgm_status', lang)}</Text>
              <View style={{ gap: 6 }}>
                {STATUS_OPTIONS.map((opt) => {
                  const active = status === opt.key;
                  const sc = STATUS_COLORS[opt.key];
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[s.selectRow, active && { borderColor: sc.color, backgroundColor: sc.bg }]}
                      onPress={() => setStatus(opt.key)}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.selectText, active && { color: sc.color }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>{t('mgm_priority', lang)}</Text>
              <View style={{ gap: 6 }}>
                {PRIORITY_OPTIONS.map((opt) => {
                  const active = priority === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[s.selectRow, active && { borderColor: opt.color, backgroundColor: opt.color + '18' }]}
                      onPress={() => setPriority(opt.key)}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.selectText, active && { color: opt.color }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Notes */}
          <View style={s.section}>
            <Text style={s.fieldLabel}>{t('mgm_notes', lang)}</Text>
            <View style={s.textAreaWrap}>
              <TextInput
                style={s.textArea}
                placeholder={t('mgm_notes_placeholder', lang)}
                placeholderTextColor={ED.ink4}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>

          {/* Save button */}
          <TouchableOpacity
            style={[edStyles.btn, edStyles.btnPrimary, { height: 50, marginTop: 8 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#1A1108" size="small" />
            ) : (
              <>
                <Ionicons name="add" size={16} color="#1A1108" />
                <Text style={[edStyles.btnText, edStyles.btnPrimaryText]}>Add to library</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 80 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: ED.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 20 : 16,
    paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: ED.line,
  },
  saveText: { fontSize: 14, fontWeight: '700', color: ED.copper },

  scroll: { paddingHorizontal: 24, paddingTop: 4 },
  titleBlock: { paddingVertical: 20 },
  titleSub: { fontSize: 13, color: ED.ink3, marginTop: 6 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, height: 50,
    borderRadius: 12, borderWidth: 1,
    borderColor: ED.copperLine,
    backgroundColor: ED.copperBg,
    marginBottom: 20,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500', color: ED.ink },

  section: { marginBottom: 20 },

  resultRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  resultRowSelected: { backgroundColor: ED.copperBg },
  resultTitle: { fontSize: 14, fontWeight: '600', color: ED.ink, marginBottom: 2 },
  resultMeta: { fontSize: 11, color: ED.ink3 },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: ED.line },

  fieldLabel: { fontFamily: MONO_FONT, fontSize: 10, fontWeight: '600', letterSpacing: 1.2, color: ED.ink3, textTransform: 'uppercase', marginBottom: 8 },

  optChip: {
    height: 32, paddingHorizontal: 12, borderRadius: 8,
    borderWidth: 1, borderColor: ED.line,
    backgroundColor: ED.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
  optChipActive: { backgroundColor: ED.copperBg, borderColor: ED.copperLine },
  optText: { fontSize: 12.5, fontWeight: '500', color: ED.ink2 },
  optTextActive: { color: ED.copper },

  selectRow: {
    height: 38, paddingHorizontal: 10, borderRadius: 8,
    borderWidth: 1, borderColor: ED.line,
    backgroundColor: ED.surface2,
    justifyContent: 'center',
  },
  selectText: { fontSize: 12.5, fontWeight: '500', color: ED.ink2 },

  textAreaWrap: {
    borderRadius: 12, borderWidth: 1, borderColor: ED.line,
    backgroundColor: ED.surface2,
    padding: 12, minHeight: 80,
  },
  textArea: { fontSize: 14, color: ED.ink2, textAlignVertical: 'top' as const, lineHeight: 22 },
});
