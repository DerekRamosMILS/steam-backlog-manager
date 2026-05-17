import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { importSteamLibrary } from '../services/steamService';
import { batchEnrichHLTB } from '../services/howLongToBeatService';
import { batchEnrichPrices } from '../services/steamPriceService';
import { getSetting, setSetting, convertAllGamePrices, deleteAllLocalData } from '../database/queries';
import { getToken, setToken, clearTokens } from '../services/secureTokenService';
import { exportData, importData } from '../services/cloudSyncService';
import * as DocumentPicker from 'expo-document-picker';
import { LibraryManager } from '../components/LibraryManager';
import { TutorialOverlay } from '../components/TutorialOverlay';
import { useAppContext } from '../hooks/useAppContext';
import { t, Language } from '../i18n';
import { ED, edStyles, MONO_FONT } from '../styles/editorial';

export default function SettingsScreen() {
  const router = useRouter();
  const { language = 'en', setLanguage, playerName, setPlayerName } = useAppContext() as any;
  const [showTutorial, setShowTutorial] = useState(false);
  const [steamId, setSteamId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [importing, setImporting] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [hltbProgress, setHltbProgress] = useState<{
    done: number; total: number; currentTitle: string;
    enriched: number; notFound: number; failed: number;
  } | null>(null);
  const [fetchingPrices, setFetchingPrices] = useState(false);
  const [priceProgress, setPriceProgress] = useState<{
    done: number; total: number; currentTitle: string;
    enriched: number; notFound: number; failed: number;
  } | null>(null);
  const [currency, setCurrency] = useState<'usd' | 'mxn'>('usd');
  const [importResult, setImportResult] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setSteamId(getSetting('steam_id'));
      setCurrency((getSetting('currency') as 'usd' | 'mxn') || 'usd');
      getToken('steam', 'api_key').then(key => { if (key) setApiKey(key); });
    }, [])
  );

  const handleSave = () => {
    setSetting('steam_id', steamId.trim());
    setSetting('currency', currency);
    if (apiKey.trim()) {
      setToken('steam', 'api_key', apiKey.trim());
    } else {
      clearTokens('steam');
    }
    Alert.alert(t('alert_saved', language), t('alert_saved_msg', language));
  };

  const handleImport = async () => {
    if (!steamId.trim()) {
      Alert.alert(t('alert_missing_steam', language), t('alert_missing_steam_msg', language));
      return;
    }
    setImporting(true);
    setImportResult(null);
    setProgress(null);
    await activateKeepAwakeAsync();
    const result = await importSteamLibrary(steamId.trim(), apiKey.trim(), (done, total) => {
      setProgress({ done, total });
    });
    setImporting(false);
    setProgress(null);
    deactivateKeepAwake();
    if (result.errors.length > 0) {
      setImportResult(`${t('sync_err_generic', language)}: ${result.errors[0]}`);
    } else {
      setImportResult(
        `${t('sync_imported_games', language)} ${result.imported} ${t('lib_games', language)}.${result.skipped > 0 ? ` (${result.skipped} ${t('sync_skipped_games', language)})` : ''}`
      );
    }
  };

  const handleEnrichHLTB = async () => {
    setEnriching(true);
    setHltbProgress(null);
    await activateKeepAwakeAsync();
    const result = await batchEnrichHLTB((next) => setHltbProgress(next));
    setEnriching(false);
    setHltbProgress(null);
    deactivateKeepAwake();
    Alert.alert(
      t('alert_hltb_done', language),
      `${result.enriched} ${t('sync_done_successfully', language)}, ${result.notFound} ${t('sync_done_not_found', language)}.`
    );
  };

  const handleEnrichPrices = async () => {
    setFetchingPrices(true);
    setPriceProgress(null);
    await activateKeepAwakeAsync();
    const result = await batchEnrichPrices((next) => setPriceProgress(next));
    setFetchingPrices(false);
    setPriceProgress(null);
    deactivateKeepAwake();
    Alert.alert(
      t('alert_prices_done', language),
      `${result.enriched} ${t('sync_done_successfully', language)}.`
    );
  };

  const handleDeleteAll = () => {
    Alert.alert(
      t('set_delete_all_confirm_title', language),
      t('set_delete_all_confirm_msg', language),
      [
        { text: t('mgm_cancel', language), style: 'cancel' },
        {
          text: t('set_delete_all_btn', language),
          style: 'destructive',
          onPress: () => {
            try {
              deleteAllLocalData();
              setSetting('onboarding_completed', 'false');
              Alert.alert(t('set_delete_all', language), t('set_delete_all_done', language));
            } catch {
              Alert.alert(t('sync_err_generic', language), t('sync_err_erase', language));
            }
          },
        },
      ]
    );
  };

  const handleCurrencyChange = (newCurrency: 'usd' | 'mxn') => {
    if (newCurrency === currency) return;
    if (fetchingPrices) { Alert.alert(t('set_currency_warn_scan', language), t('set_currency_warn_scan_msg', language)); return; }
    Alert.alert(
      t('set_currency_change_title', language),
      t('set_currency_change_msg', language),
      [
        { text: t('share_back', language), style: 'cancel' },
        {
          text: t('set_currency_convert', language), style: 'destructive',
          onPress: () => {
            const multiplier = newCurrency === 'mxn' ? 20.3 : (1 / 20.3);
            convertAllGamePrices(multiplier);
            setCurrency(newCurrency);
            setSetting('currency', newCurrency);
          }
        }
      ]
    );
  };

  const handleExportBackup = async () => {
    try {
      const path = await exportData();
      Alert.alert(t('alert_export_ok', language), `Data exported to ${path}`);
    } catch {
      Alert.alert(t('alert_export_fail', language), t('alert_export_fail_msg', language));
    }
  };

  const handleImportBackup = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const success = await importData(result.assets[0].uri);
      Alert.alert(
        success ? t('alert_import_ok', language) : t('alert_import_fail', language),
        success ? t('alert_import_ok_msg', language) : t('alert_import_fail_msg', language)
      );
    } catch {
      Alert.alert(t('alert_import_fail', language), t('alert_import_fail_msg', language));
    }
  };

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={s.header}>
          {playerName && (
            <Text style={[edStyles.eyebrow, { marginBottom: 6 }]}>ACCOUNT · {(playerName as string).toUpperCase()}</Text>
          )}
          <Text style={[edStyles.displayTitle, { fontSize: 38 }]}>Settings.</Text>
        </View>

        {/* ── Libraries ── */}
        <SettingsSection title={t('set_steam_account', language) as string} subtitle="Connected platforms">
          <LibraryManager />
        </SettingsSection>

        {/* ── Data quality ── */}
        <SettingsSection title="Data quality">
          <ProgressableRow
            icon="time-outline"
            label={t('set_sync_hltb', language) as string}
            sub={t('set_hltb_help', language) as string}
            loading={enriching}
            progress={hltbProgress ? { done: hltbProgress.done, total: hltbProgress.total, current: hltbProgress.currentTitle } : null}
            onPress={handleEnrichHLTB}
          />
          <ProgressableRow
            icon="cash-outline"
            label={t('set_library_value', language) as string}
            sub={t('set_library_value_help', language) as string}
            loading={fetchingPrices}
            progress={priceProgress ? { done: priceProgress.done, total: priceProgress.total, current: priceProgress.currentTitle } : null}
            onPress={handleEnrichPrices}
          />
        </SettingsSection>

        {/* ── Appearance ── */}
        <SettingsSection title="Appearance">
          {/* Language */}
          <View style={s.row}>
            <View style={[s.rowIcon, { backgroundColor: ED.surface2 }]}>
              <Ionicons name="globe-outline" size={15} color={ED.ink2} />
            </View>
            <Text style={s.rowLabel}>{t('set_language', language)}</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {(['en', 'es'] as const).map((lang) => (
                <TouchableOpacity
                  key={lang}
                  style={[s.langBtn, language === lang && s.langBtnActive]}
                  onPress={() => setLanguage(lang)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.langBtnText, language === lang && s.langBtnTextActive]}>
                    {lang === 'en' ? 'EN' : 'ES'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Currency */}
          <View style={s.row}>
            <View style={[s.rowIcon, { backgroundColor: ED.surface2 }]}>
              <Ionicons name="card-outline" size={15} color={ED.ink2} />
            </View>
            <Text style={s.rowLabel}>{t('set_currency_label', language)}</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {(['usd', 'mxn'] as const).map((cur) => (
                <TouchableOpacity
                  key={cur}
                  style={[s.langBtn, currency === cur && s.langBtnActive]}
                  onPress={() => handleCurrencyChange(cur)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.langBtnText, currency === cur && s.langBtnTextActive]}>
                    {cur.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </SettingsSection>

        {/* ── Steam config ── */}
        <SettingsSection title={t('set_steam_account', language) as string} subtitle="Steam ID & API key">
          <View style={{ padding: 16, gap: 14 }}>
            <View>
              <Text style={s.fieldLabel}>{t('set_steam_id_label', language)}</Text>
              <Text style={s.fieldHint}>{t('set_steam_id_hint', language)}</Text>
              <View style={s.inputWrap}>
                <TextInput
                  style={s.input}
                  value={steamId}
                  onChangeText={setSteamId}
                  placeholder="76561198xxxxxxxxx"
                  placeholderTextColor={ED.ink4}
                  autoCapitalize="none"
                />
              </View>
            </View>
            <View>
              <Text style={s.fieldLabel}>{t('set_api_key_label', language)}</Text>
              <TouchableOpacity onPress={() => Linking.openURL('https://steamcommunity.com/dev/apikey')}>
                <Text style={[s.fieldHint, { color: ED.copper }]}>{t('set_api_key_hint', language)}</Text>
              </TouchableOpacity>
              <View style={s.inputWrap}>
                <TextInput
                  style={s.input}
                  value={apiKey}
                  onChangeText={setApiKey}
                  placeholder="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                  placeholderTextColor={ED.ink4}
                  autoCapitalize="none"
                  secureTextEntry
                />
              </View>
            </View>
            <TouchableOpacity style={[edStyles.btn, edStyles.btnPrimary, { height: 46 }]} onPress={handleSave} activeOpacity={0.8}>
              <Ionicons name="checkmark" size={15} color="#1A1108" />
              <Text style={[edStyles.btnText, edStyles.btnPrimaryText]}>{t('set_save_settings', language)}</Text>
            </TouchableOpacity>
          </View>

          {/* Steam import */}
          <View style={[s.divider]} />
          <View style={{ padding: 16, gap: 10 }}>
            <Text style={s.helpText}>{t('set_steam_help', language)}</Text>
            {importing && progress && (
              <ProgressBar done={progress.done} total={progress.total} color={ED.sky} />
            )}
            {importResult && (
              <View style={[s.resultChip, importResult.startsWith('Error') ? s.resultChipErr : s.resultChipOk]}>
                <Ionicons name={importResult.startsWith('Error') ? 'close-circle' : 'checkmark-circle'} size={14} color={importResult.startsWith('Error') ? ED.rust : ED.moss} />
                <Text style={[s.resultText, { color: importResult.startsWith('Error') ? ED.rust : ED.moss }]}>{importResult}</Text>
              </View>
            )}
            <TouchableOpacity
              style={[s.actionBtn, { borderColor: ED.skyBg, backgroundColor: 'rgba(125,160,194,0.1)' }]}
              onPress={handleImport}
              disabled={importing}
              activeOpacity={0.8}
            >
              {importing ? <ActivityIndicator color={ED.sky} size="small" /> : <Ionicons name="refresh-outline" size={15} color={ED.sky} />}
              <Text style={[s.actionBtnText, { color: ED.sky }]}>{importing ? t('set_working', language) : t('set_steam_import_btn', language)}</Text>
            </TouchableOpacity>
          </View>
        </SettingsSection>

        {/* ── Discovery ── */}
        <SettingsSection title="Discovery">
          <SettingsRow
            icon="cart-outline"
            label="Purchase Advisor"
            sub="Should I buy this new game?"
            onPress={() => router.push('/purchase-advisor' as any)}
          />
          <SettingsRow
            icon="share-outline"
            label="Share my backlog"
            sub="Export as image"
            onPress={() => router.push('/share' as any)}
            last
          />
        </SettingsSection>

        {/* ── Data ── */}
        <SettingsSection title="Data">
          <SettingsRow
            icon="download-outline"
            label={t('settings_export_btn', language) as string}
            sub=".json backup"
            onPress={handleExportBackup}
          />
          <SettingsRow
            icon="cloud-upload-outline"
            label={t('settings_import_btn', language) as string}
            sub="Restore from backup"
            onPress={handleImportBackup}
          />
          <SettingsRow
            icon="trash-outline"
            label={t('set_delete_all', language) as string}
            danger
            onPress={handleDeleteAll}
            last
          />
        </SettingsSection>

        {/* ── About ── */}
        <SettingsSection title="About">
          <SettingsRow icon="map-outline" label="App Tour" sub="Quick feature walkthrough" onPress={() => setShowTutorial(true)} />
          <View style={[edStyles.specRow, { paddingHorizontal: 16 }]}>
            <Text style={edStyles.specKey}>Version</Text>
            <Text style={edStyles.specVal}>1.0.0</Text>
          </View>
          <View style={[edStyles.specRow, { paddingHorizontal: 16 }]}>
            <Text style={edStyles.specKey}>Storage</Text>
            <Text style={edStyles.specVal}>Offline SQLite</Text>
          </View>
          <TouchableOpacity
            style={[s.row, { borderBottomWidth: 0 }]}
            onPress={() => Linking.openURL('https://www.notion.so/BacklogFlow-Privacy-Policy-31ed90ccdf658095b9e6ce948d38b762')}
            activeOpacity={0.8}
          >
            <View style={[s.rowIcon, { backgroundColor: ED.surface2 }]}>
              <Ionicons name="shield-checkmark-outline" size={15} color={ED.ink2} />
            </View>
            <Text style={s.rowLabel}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={14} color={ED.ink3} />
          </TouchableOpacity>
        </SettingsSection>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerEyebrow}>BACKLOGFLOW · 2026</Text>
          <Text style={s.footerTagline}>Built for the patient player.</Text>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <TutorialOverlay visible={showTutorial} onClose={() => setShowTutorial(false)} />
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SettingsSection({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <View style={s.section}>
      <View style={edStyles.sectionHead}>
        <Text style={edStyles.eyebrow}>{title}</Text>
        {subtitle && <Text style={[edStyles.eyebrow, { color: ED.ink3 }]}>{subtitle}</Text>}
      </View>
      <View style={[edStyles.card, { overflow: 'hidden' }]}>
        {children}
      </View>
    </View>
  );
}

function SettingsRow({ icon, label, sub, detail, danger, last, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string; sub?: string; detail?: string;
  danger?: boolean; last?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={[s.row, last && { borderBottomWidth: 0 }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
    >
      <View style={[s.rowIcon, danger ? { backgroundColor: ED.rustBg } : { backgroundColor: ED.surface2 }]}>
        <Ionicons name={icon} size={15} color={danger ? ED.rust : ED.ink2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.rowLabel, danger && { color: ED.rust }]}>{label}</Text>
        {sub && <Text style={s.rowSub}>{sub}</Text>}
      </View>
      {detail && <Text style={s.rowDetail}>{detail}</Text>}
      {onPress && !detail && <Ionicons name="chevron-forward" size={14} color={ED.ink3} />}
    </TouchableOpacity>
  );
}

function ProgressableRow({ icon, label, sub, loading, progress, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string; sub?: string;
  loading: boolean;
  progress: { done: number; total: number; current: string } | null;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress} disabled={loading} activeOpacity={0.75}>
      <View style={[s.rowIcon, { backgroundColor: ED.surface2 }]}>
        {loading ? <ActivityIndicator size="small" color={ED.copper} /> : <Ionicons name={icon} size={15} color={ED.ink2} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.rowLabel}>{label}</Text>
        {progress ? (
          <>
            <Text style={[s.rowSub, { color: ED.copper }]} numberOfLines={1}>{progress.current}</Text>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: progress.total > 0 ? `${Math.round((progress.done / progress.total) * 100)}%` as any : '0%' }]} />
            </View>
          </>
        ) : sub ? (
          <Text style={s.rowSub}>{sub}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={14} color={ED.ink3} />
    </TouchableOpacity>
  );
}

function ProgressBar({ done, total, color }: { done: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <View style={{ gap: 4, marginVertical: 4 }}>
      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={s.progressLabel}>{done} / {total}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: ED.bg },
  scroll: { paddingTop: Platform.OS === 'ios' ? 60 : 48, paddingHorizontal: 24 },
  header: { marginBottom: 24 },
  section: { marginBottom: 24 },
  divider: { height: 1, backgroundColor: ED.line, marginHorizontal: 16 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    minHeight: 56, borderBottomWidth: 1, borderBottomColor: ED.line,
  },
  rowIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowLabel: { fontSize: 14, fontWeight: '500', color: ED.ink, letterSpacing: -0.01 },
  rowSub: { fontSize: 11, color: ED.ink3, marginTop: 2 },
  rowDetail: { fontFamily: MONO_FONT, fontSize: 13, color: ED.ink3 },

  langBtn: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
    borderWidth: 1, borderColor: ED.line,
  },
  langBtnActive: { backgroundColor: ED.copperBg, borderColor: ED.copperLine },
  langBtnText: { fontFamily: MONO_FONT, fontSize: 11, fontWeight: '600', color: ED.ink3 },
  langBtnTextActive: { color: ED.copper },

  fieldLabel: { fontSize: 13, fontWeight: '600', color: ED.ink2, marginBottom: 3 },
  fieldHint: { fontSize: 11, color: ED.ink3, marginBottom: 6 },
  inputWrap: {
    borderRadius: 10, borderWidth: 1, borderColor: ED.line,
    backgroundColor: ED.surface2, paddingHorizontal: 12, height: 44, justifyContent: 'center',
  },
  input: { fontSize: 14, color: ED.ink, fontFamily: MONO_FONT },

  helpText: { fontSize: 12.5, color: ED.ink3, lineHeight: 18 },
  actionBtn: {
    height: 44, borderRadius: 12, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  actionBtnText: { fontSize: 14, fontWeight: '600' },
  resultChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 8, borderWidth: 1, padding: 10,
  },
  resultChipOk: { borderColor: 'rgba(143,165,106,0.3)', backgroundColor: 'rgba(143,165,106,0.08)' },
  resultChipErr: { borderColor: 'rgba(193,104,71,0.3)', backgroundColor: 'rgba(193,104,71,0.08)' },
  resultText: { fontSize: 12.5, flex: 1 },

  progressTrack: { height: 4, backgroundColor: ED.surface3, borderRadius: 100, overflow: 'hidden', marginTop: 4 },
  progressFill: { height: '100%' as any, backgroundColor: ED.copper, borderRadius: 100 },
  progressLabel: { fontFamily: MONO_FONT, fontSize: 10, color: ED.ink3, textAlign: 'right' as const },

  footer: { alignItems: 'center', paddingVertical: 24 },
  footerEyebrow: { fontFamily: MONO_FONT, fontSize: 10, fontWeight: '600', letterSpacing: 1.4, textTransform: 'uppercase', color: ED.ink4, marginBottom: 4 },
  footerTagline: { fontSize: 12, color: ED.ink4, fontStyle: 'italic' },
});
