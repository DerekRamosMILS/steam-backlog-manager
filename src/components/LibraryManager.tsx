import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../hooks/useAppContext';
import { GlassCard } from './GlassCard';
import { SectionHeader } from './SectionHeader';
import { PlatformLoginModal } from './PlatformLoginModal';
import { PLATFORM_CONFIG, ImportPlatform, PlatformConnection } from '../types';
import { getSetting, getGameCountByPlatform } from '../database/queries';
import { t } from '../i18n';

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
  const { themeColors, language } = useAppContext();
  const lang = language ?? 'en';
  const styles = getStyles(themeColors);

  const [connections, setConnections] = useState<Partial<Record<ImportPlatform, PlatformConnection>>>({
    steam: { platform: 'steam', connected: false, lastSynced: null },
    gog: { platform: 'gog', connected: false, lastSynced: null },
  });

  const [loginModalVisible, setLoginModalVisible] = useState(false);
  const [loginPlatform, setLoginPlatform] = useState<ImportPlatform>('gog');
  const [importing, setImporting] = useState<ImportPlatform | null>(null);
  const [importResult, setImportResult] = useState<{ platform: ImportPlatform; message: string; isError: boolean } | null>(null);

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

  useEffect(() => {
    refreshConnections();
  }, [refreshConnections]);

  // Refresh when modal closes (games may have been added manually)
  const handleModalClose = () => {
    setLoginModalVisible(false);
    refreshConnections();
    onImportComplete?.();
  };

  const platforms: ImportPlatform[] = ['steam', 'gog'];

  return (
    <View>
      <SectionHeader
        title={lang === 'es' ? 'Bibliotecas de Juegos' : 'Game Libraries'}
        icon="library"
        iconColor={themeColors.accent}
      />
      <GlassCard padding={0}>
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
                styles.row,
                index < platforms.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: themeColors.glassBorder,
                },
              ]}
            >
              {/* Platform icon */}
              <View style={[styles.platformIcon, { backgroundColor: config.color + '22' }]}>
                <Ionicons
                  name={config.icon as keyof typeof Ionicons.glyphMap}
                  size={20}
                  color={config.color}
                />
              </View>

              <View style={styles.platformInfo}>
                <Text style={[styles.platformName, { color: themeColors.textPrimary }]}>
                  {config.label}
                </Text>

                {isSteam ? (
                  /* Steam: show sync status */
                  <View style={styles.statusRow}>
                    <View style={[styles.statusDot, {
                      backgroundColor: conn.connected ? themeColors.green : themeColors.textMuted,
                    }]} />
                    <Text style={[styles.statusText, { color: themeColors.textMuted }]}>
                      {conn.connected
                        ? conn.lastSynced
                          ? (lang === 'es' ? `Sincronizado ${formatTimeSince(conn.lastSynced, lang)}` : `Synced ${formatTimeSince(conn.lastSynced, lang)}`)
                          : (lang === 'es' ? 'Conectado' : 'Connected')
                        : (lang === 'es' ? 'Sin configurar' : 'Not configured')}
                    </Text>
                  </View>
                ) : (
                  /* GOG / Epic: always show game count, no connected status */
                  <Text style={[styles.statusText, { color: themeColors.textMuted }]}>
                    {count} {t('lib_games_added', lang as any)}
                  </Text>
                )}
              </View>

              {/* Actions */}
              <View style={styles.actions}>
                {isSteam ? (
                  <View style={[styles.steamTag, {
                    backgroundColor: themeColors.glass,
                    borderColor: themeColors.glassBorder,
                  }]}>
                    <Text style={[styles.steamTagText, { color: themeColors.textMuted }]}>
                      API Key
                    </Text>
                  </View>
                ) : (
                  /* GOG / Epic: "Manual — why?" opens the info modal */
                  <TouchableOpacity
                    style={[styles.manualBtn, {
                      borderColor: config.color + '55',
                      backgroundColor: config.color + '15',
                    }]}
                    onPress={() => {
                      setLoginPlatform(platform);
                      setLoginModalVisible(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="help-circle-outline" size={13} color={config.color} />
                    <Text style={[styles.manualBtnText, { color: config.color }]}>
                      {t('lib_manual_why', lang as any)}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Import progress */}
              {isImporting && (
                <View style={styles.progressOverlay}>
                  <ActivityIndicator size="small" color={themeColors.teal} />
                </View>
              )}

              {/* Result chip */}
              {result && (
                <View style={[
                  styles.resultChip,
                  result.isError
                    ? { borderColor: themeColors.red + '55', backgroundColor: themeColors.red + '11' }
                    : { borderColor: themeColors.green + '55', backgroundColor: themeColors.green + '11' },
                ]}>
                  <Ionicons
                    name={result.isError ? 'close-circle' : 'checkmark-circle'}
                    size={12}
                    color={result.isError ? themeColors.red : themeColors.green}
                  />
                  <Text style={[styles.resultText, {
                    color: result.isError ? themeColors.red : themeColors.green,
                  }]}>
                    {result.message}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </GlassCard>

      <PlatformLoginModal
        visible={loginModalVisible}
        platform={loginPlatform}
        onSuccess={handleModalClose}
        onClose={handleModalClose}
      />
    </View>
  );
}

const getStyles = (themeColors: any) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      gap: 12,
      flexWrap: 'wrap',
    },
    platformIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    platformInfo: {
      flex: 1,
      gap: 3,
    },
    platformName: {
      fontSize: 15,
      fontWeight: '700',
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusText: {
      fontSize: 12,
    },
    actions: {
      flexDirection: 'row',
      gap: 6,
    },
    manualBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      height: 32,
      paddingHorizontal: 10,
      borderRadius: 10,
      borderWidth: 1,
    },
    manualBtnText: {
      fontSize: 12,
      fontWeight: '700',
    },
    steamTag: {
      height: 28,
      paddingHorizontal: 10,
      borderRadius: 8,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    steamTagText: {
      fontSize: 11,
      fontWeight: '600',
    },
    progressOverlay: {
      width: '100%',
      alignItems: 'center',
      paddingVertical: 4,
    },
    resultChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 8,
      borderWidth: 1,
      padding: 8,
      width: '100%',
      marginTop: 4,
    },
    resultText: {
      fontSize: 12,
      flex: 1,
    },
  });
