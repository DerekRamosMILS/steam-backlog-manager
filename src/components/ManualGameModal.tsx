import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppContext } from '../hooks/useAppContext';
import { searchGamesByTitle } from '../services/gameSearchService';
import { insertManualGame } from '../database/queries';
import { ManualGameSearchResult, GameStatus, GamePriority, Platform } from '../types';
import { t, Language } from '../i18n';

interface Props {
  visible: boolean;
  onClose: () => void;
  onGameAdded: () => void;
}

function getStatusOptions(lang: Language): { key: GameStatus; label: string }[] {
  return [
    { key: 'not_started', label: t('mgm_status_not_started', lang) },
    { key: 'up_next', label: t('mgm_status_up_next', lang) },
    { key: 'playing', label: t('mgm_status_playing', lang) },
    { key: 'paused', label: t('mgm_status_paused', lang) },
  ];
}

function getPriorityOptions(lang: Language): { key: GamePriority; label: string }[] {
  return [
    { key: 'high', label: t('mgm_priority_high', lang) },
    { key: 'medium', label: t('mgm_priority_medium', lang) },
    { key: 'low', label: t('mgm_priority_low', lang) },
  ];
}

const PLATFORM_OPTIONS: { key: Platform; label: string }[] = [
  { key: 'steam', label: 'Steam' },
  { key: 'gog', label: 'GOG' },
  { key: 'epic', label: 'Epic' },
  { key: 'playstation', label: 'PlayStation' },
  { key: 'xbox', label: 'Xbox' },
  { key: 'nintendo', label: 'Nintendo' },
  { key: 'other', label: 'Other' },
];

export function ManualGameModal({ visible, onClose, onGameAdded }: Props) {
  const { themeColors, language } = useAppContext();
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState<Platform>('other');
  const [status, setStatus] = useState<GameStatus>('not_started');
  const [priority, setPriority] = useState<GamePriority>('medium');
  const [notes, setNotes] = useState('');
  const [searchResults, setSearchResults] = useState<ManualGameSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedGame, setSelectedGame] = useState<ManualGameSearchResult | null>(null);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const STATUS_OPTIONS = getStatusOptions(language as Language);
  const PRIORITY_OPTIONS = getPriorityOptions(language as Language);

  const handleTitleChange = (text: string) => {
    setTitle(text);
    setSelectedGame(null);
    if (text.trim().length < 2) {
      setSearchResults([]);
      return;
    }
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
    setTitle('');
    setPlatform('other');
    setStatus('not_started');
    setPriority('medium');
    setNotes('');
    setSearchResults([]);
    setSelectedGame(null);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert(t('mgm_alert_title_req', language as Language), t('mgm_alert_title_msg', language as Language));
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
    } catch (e) {
      Alert.alert(t('mgm_alert_error', language as Language), t('mgm_alert_error_msg', language as Language));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: themeColors.bg }]}>
        <LinearGradient colors={[themeColors.bg, themeColors.card]} style={StyleSheet.absoluteFill} />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { reset(); onClose(); }} style={styles.cancelBtn}>
            <Text style={[styles.cancelText, { color: themeColors.textMuted }]}>{t('mgm_cancel', language as Language)}</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>{t('mgm_add_game', language as Language)}</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving} style={[styles.saveBtn, { backgroundColor: themeColors.accent }]}>
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveText}>{t('mgm_save', language as Language)}</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Title */}
          <Text style={[styles.label, { color: themeColors.textSecondary }]}>{t('mgm_title_label', language as Language)}</Text>
          <View style={[styles.inputWrap, { borderColor: themeColors.glassBorder, backgroundColor: themeColors.glass }]}>
            <TextInput
              style={[styles.input, { color: themeColors.textPrimary }]}
              placeholder={t('mgm_title_placeholder', language as Language)}
              placeholderTextColor={themeColors.textMuted}
              value={title}
              onChangeText={handleTitleChange}
              autoCorrect={false}
            />
            {searching && <ActivityIndicator size="small" color={themeColors.accent} />}
          </View>

          {/* Search results */}
          {searchResults.length > 0 && (
            <View style={[styles.resultsPanel, { backgroundColor: themeColors.card, borderColor: themeColors.glassBorder }]}>
              {searchResults.map((game) => (
                <TouchableOpacity
                  key={game.igdbId}
                  style={[styles.resultItem, { borderBottomColor: themeColors.glassBorder }]}
                  onPress={() => selectGame(game)}
                >
                  <View>
                    <Text style={[styles.resultTitle, { color: themeColors.textPrimary }]}>{game.title}</Text>
                    <Text style={[styles.resultMeta, { color: themeColors.textMuted }]}>
                      {[game.releaseYear, game.developer].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={themeColors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Selected metadata preview */}
          {selectedGame && (
            <View style={[styles.metaCard, { backgroundColor: themeColors.card, borderColor: themeColors.accent + '55' }]}>
              <Ionicons name="checkmark-circle" size={16} color={themeColors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.metaTitle, { color: themeColors.textPrimary }]}>{selectedGame.title}</Text>
                <Text style={[styles.metaMeta, { color: themeColors.textMuted }]}>
                  {[selectedGame.releaseYear, selectedGame.developer, selectedGame.platforms.slice(0, 2).join(', ')].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <TouchableOpacity onPress={() => { setSelectedGame(null); setTitle(''); }}>
                <Ionicons name="close-circle-outline" size={20} color={themeColors.textMuted} />
              </TouchableOpacity>
            </View>
          )}

          {/* Platform */}
          <Text style={[styles.label, { color: themeColors.textSecondary }]}>{t('mgm_platform', language as Language)}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            <View style={styles.optRow}>
              {PLATFORM_OPTIONS.map((opt) => {
                const active = platform === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.optChip, { borderColor: active ? themeColors.accent : themeColors.glassBorder, backgroundColor: active ? themeColors.accent + '22' : 'transparent' }]}
                    onPress={() => setPlatform(opt.key)}
                  >
                    <Text style={[styles.optText, { color: active ? themeColors.accent : themeColors.textSecondary }]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Status */}
          <Text style={[styles.label, { color: themeColors.textSecondary }]}>{t('mgm_status', language as Language)}</Text>
          <View style={[styles.optRow, { marginBottom: 16 }]}>
            {STATUS_OPTIONS.map((opt) => {
              const active = status === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.optChip, { borderColor: active ? themeColors.teal : themeColors.glassBorder, backgroundColor: active ? themeColors.teal + '22' : 'transparent' }]}
                  onPress={() => setStatus(opt.key)}
                >
                  <Text style={[styles.optText, { color: active ? themeColors.teal : themeColors.textSecondary }]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Priority */}
          <Text style={[styles.label, { color: themeColors.textSecondary }]}>{t('mgm_priority', language as Language)}</Text>
          <View style={[styles.optRow, { marginBottom: 16 }]}>
            {PRIORITY_OPTIONS.map((opt) => {
              const active = priority === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.optChip, { borderColor: active ? themeColors.violet : themeColors.glassBorder, backgroundColor: active ? themeColors.violet + '22' : 'transparent' }]}
                  onPress={() => setPriority(opt.key)}
                >
                  <Text style={[styles.optText, { color: active ? themeColors.violet : themeColors.textSecondary }]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Notes */}
          <Text style={[styles.label, { color: themeColors.textSecondary }]}>{t('mgm_notes', language as Language)}</Text>
          <View style={[styles.inputWrap, styles.textAreaWrap, { borderColor: themeColors.glassBorder, backgroundColor: themeColors.glass }]}>
            <TextInput
              style={[styles.input, styles.textArea, { color: themeColors.textPrimary }]}
              placeholder={t('mgm_notes_placeholder', language as Language)}
              placeholderTextColor={themeColors.textMuted}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  cancelBtn: { padding: 4 },
  cancelText: { fontSize: 16 },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 10, minWidth: 60, alignItems: 'center' },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  scroll: { padding: 16 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  inputWrap: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, height: 44, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  textAreaWrap: { height: 88, alignItems: 'flex-start', paddingTop: 10 },
  input: { flex: 1, fontSize: 15 },
  textArea: { textAlignVertical: 'top' },
  resultsPanel: { borderRadius: 12, borderWidth: 1, marginBottom: 12, overflow: 'hidden' },
  resultItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  resultTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  resultMeta: { fontSize: 12 },
  metaCard: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 16 },
  metaTitle: { fontSize: 14, fontWeight: '700' },
  metaMeta: { fontSize: 12, marginTop: 2 },
  optRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  optChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  optText: { fontSize: 13, fontWeight: '600' },
});
