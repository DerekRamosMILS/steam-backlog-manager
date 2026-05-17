import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../hooks/useAppContext';
import { PlatformLoginModal } from './PlatformLoginModal';
import { PLATFORM_CONFIG, ImportPlatform, PlatformConnection } from '../types';
import { getSetting, getGameCountByPlatform } from '../database/queries';
import { t } from '../i18n';
import { ED, edStyles, MONO_FONT } from '../styles/editorial';

interface LibraryManagerProps {
  onImportComplete?: () => void;
}

function formatTimeSince(iso: string | null, lang: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return lang === 'es' ? 'ahora mismo' : 'just now';
  if (mins < 60) return lang === 'es' ? `hace ${mins}m` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return lang === 'es' ? `hace ${hrs}h` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return lang === 'es' ? `hace ${days}d` : `${days}d ago`;
}

export function LibraryManager({ onImportComplete }: LibraryManagerProps) {
  const { language } = useAppContext();
  const lang = language ?? 'en';

  const [connections, setConnections] = useState<Partial<Record<ImportPlatform, PlatformConnection>>>({
    steam: { platform: 'steam', connected: false, lastSynced: null },
    gog: { platform: 'gog', connected: false, lastSynced: null },
  });

  const [loginModalVisible, setLoginModalVisible] = useState(false);
  const [loginPlatform, setLoginPlatform] = useState<ImportPlatform>('gog');
  const [importing] = useState<ImportPlatform | null>(null);
  const [importResult] = useState<{ platform: ImportPlatform; message: string; isError: boolean } | null>(null);

  const refreshConnections = useCallback(() => {
    const steamId = getSetting('steam_id');
    const steamLastSync = getSetting('steam_last_sync') || null;

    setConnections({
      steam: {
        platform: 'steam',
        connected: !!steamId,
        lastSynced: steamLastSync,
        gameCount: getGameCountByPlatform('steam'),
      },
      gog: {
        platform: 'gog',
        connected: false,
        lastSynced: null,
        gameCount: getGameCountByPlatform('gog'),
      },
    });
  }, []);

  useEffect(() => { refreshConnections(); }, [refreshConnections]);

  const handleModalClose = () => {
    setLoginModalVisible(false);
    refreshConnections();
    onImportComplete?.();
  };

  const platforms: ImportPlatform[] = ['steam', 'gog'];

  return (
    <View>
      <View style={edStyles.card}>
        {platforms.map((platform, index) => {
          const config = PLATFORM_CONFIG[platform];
          const conn = connections[platform] ?? { platform, connected: false, lastSynced: null };
          const isImporting = importing === platform;
          const result = importResult?.platform === platform ? importResult : null;
          const isSteam = platform === 'steam';
          const count = conn.gameCount ?? 0;

          return (
            <View
              key={platform}
              style={[
                s.row,
                index < platforms.length - 1 && { borderBottomWidth: 1, borderBottomColor: ED.line },
              ]}
            >
              <View style={[s.platformIcon, { backgroundColor: config.color + '22' }]}>
                <Ionicons
                  name={config.icon as keyof typeof Ionicons.glyphMap}
                  size={18}
                  color={config.color}
                />
              </View>

              <View style={s.platformInfo}>
                <Text style={s.platformName}>{config.label}</Text>

                {isSteam ? (
                  <View style={s.statusRow}>
                    <View style={[s.statusDot, { backgroundColor: conn.connected ? ED.moss : ED.ink4 }]} />
                    <Text style={s.statusText}>
                      {conn.connected
                        ? conn.lastSynced
                          ? (lang === 'es' ? `Sincronizado ${formatTimeSince(conn.lastSynced, lang)}` : `Synced ${formatTimeSince(conn.lastSynced, lang)}`)
                          : (lang === 'es' ? 'Conectado' : 'Connected')
                        : (lang === 'es' ? 'Sin configurar' : 'Not configured')}
                    </Text>
                  </View>
                ) : (
                  <Text style={s.statusText}>
                    {count} {t('lib_games_added', lang as any)}
                  </Text>
                )}
              </View>

              <View style={s.actions}>
                {isSteam ? (
                  <View style={s.tag}>
                    <Text style={s.tagText}>API KEY</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[s.manualBtn, { borderColor: config.color + '55', backgroundColor: config.color + '15' }]}
                    onPress={() => { setLoginPlatform(platform); setLoginModalVisible(true); }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="help-circle-outline" size={12} color={config.color} />
                    <Text style={[s.manualBtnText, { color: config.color }]}>
                      {t('lib_manual_why', lang as any)}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {isImporting && (
                <View style={s.progressOverlay}>
                  <ActivityIndicator size="small" color={ED.copper} />
                </View>
              )}

              {result && (
                <View style={[
                  s.resultChip,
                  result.isError
                    ? { borderColor: ED.rust + '55', backgroundColor: ED.rust + '11' }
                    : { borderColor: ED.moss + '55', backgroundColor: ED.moss + '11' },
                ]}>
                  <Ionicons
                    name={result.isError ? 'close-circle' : 'checkmark-circle'}
                    size={12}
                    color={result.isError ? ED.rust : ED.moss}
                  />
                  <Text style={[s.resultText, { color: result.isError ? ED.rust : ED.moss }]}>
                    {result.message}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      <PlatformLoginModal
        visible={loginModalVisible}
        platform={loginPlatform}
        onSuccess={handleModalClose}
        onClose={handleModalClose}
      />
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, flexWrap: 'wrap',
  },
  platformIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  platformInfo: { flex: 1, gap: 3 },
  platformName: { fontSize: 14, fontWeight: '700', color: ED.ink },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, color: ED.ink3 },
  actions: { flexDirection: 'row', gap: 6 },
  manualBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    height: 28, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1,
  },
  manualBtnText: { fontSize: 11, fontWeight: '700' },
  tag: {
    height: 26, paddingHorizontal: 9, borderRadius: 6,
    borderWidth: 1, borderColor: ED.line, backgroundColor: ED.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
  tagText: { fontFamily: MONO_FONT, fontSize: 9, fontWeight: '600', color: ED.ink3, letterSpacing: 0.8 },
  progressOverlay: { width: '100%', alignItems: 'center', paddingVertical: 4 },
  resultChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 8, borderWidth: 1, padding: 8, width: '100%', marginTop: 4,
  },
  resultText: { fontSize: 11, flex: 1 },
});
