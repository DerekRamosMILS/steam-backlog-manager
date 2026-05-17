import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../hooks/useAppContext';
import { PLATFORM_CONFIG, ImportPlatform } from '../types';
import { t, Language } from '../i18n';

interface PlatformLoginModalProps {
  visible: boolean;
  platform: ImportPlatform;
  onSuccess: () => void;
  onClose: () => void;
}

/**
 * NOTE: GOG and Epic Games do not expose public APIs for game library access
 * on mobile platforms. The major app stores (Apple App Store / Google Play)
 * prohibit embedding third-party login flows inside WebViews for apps that
 * are not the platform's official client.
 *
 * BacklogFlow supports Steam via the official Steam Web API (API key + public
 * profile). Games from other platforms can be added manually using the
 * "Add Game" button, which searches IGDB for rich metadata, artwork, and
 * completion estimates automatically.
 */
export function PlatformLoginModal({
  visible,
  platform,
  onClose,
}: PlatformLoginModalProps) {
  const { themeColors, language } = useAppContext();
  const lang = (language ?? 'en') as Language;
  const config = PLATFORM_CONFIG[platform];
  if (!config) return null;

  const isPlatformWithNoApi = platform === 'gog';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      </Pressable>

      <View style={styles.container} pointerEvents="box-none">
        <View style={[styles.sheet, { borderColor: themeColors.glassBorder }]}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={[config.color + '28', config.color + '0a']}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.headerIcon, { backgroundColor: config.color + '33' }]}>
              <Ionicons
                name={config.icon as keyof typeof Ionicons.glyphMap}
                size={22}
                color={config.color}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>
                {config.label}
              </Text>
              <Text style={[styles.headerSub, { color: themeColors.textMuted }]}>
                {isPlatformWithNoApi ? t('plat_no_api', lang) : t('plat_platform_import', lang)}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close-circle" size={24} color={themeColors.textMuted} />
            </TouchableOpacity>
          </View>

          {isPlatformWithNoApi ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.infoContent}
            >
              {/* Main explanation */}
              <View style={[styles.infoBox, { backgroundColor: themeColors.card, borderColor: themeColors.glassBorder }]}>
                <Ionicons name="information-circle-outline" size={28} color={config.color} />
                <Text style={[styles.infoTitle, { color: themeColors.textPrimary }]}>
                  {t('plat_gog_no_api_title', lang)}
                </Text>
                <Text style={[styles.infoBody, { color: themeColors.textSecondary }]}>
                  {t('plat_gog_no_api_body', lang)}
                </Text>
              </View>

              {/* What you can do */}
              <View style={[styles.alternativeBox, { backgroundColor: themeColors.card, borderColor: themeColors.glassBorder }]}>
                <Text style={[styles.altTitle, { color: themeColors.textPrimary }]}>
                  {t('plat_manual_add_title', lang).replace('{platform}', config.label)}
                </Text>

                {[
                  { icon: 'search-outline' as const, text: t('plat_step1', lang) },
                  { icon: 'game-controller-outline' as const, text: t('plat_step2', lang) },
                  { icon: 'image-outline' as const, text: t('plat_step3', lang) },
                  { icon: 'layers-outline' as const, text: `${t('plat_step4_prefix', lang)} ${config.label} ${t('plat_step4_suffix', lang)}` },
                ].map((step, i) => (
                  <View key={i} style={styles.altStep}>
                    <View style={[styles.altStepDot, { backgroundColor: config.color + '33' }]}>
                      <Ionicons name={step.icon} size={16} color={config.color} />
                    </View>
                    <Text style={[styles.altStepText, { color: themeColors.textSecondary }]}>
                      {step.text}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Steam note */}
              <View style={[styles.steamNote, { borderColor: '#1b283855' }]}>
                <Ionicons name="logo-steam" size={18} color="#4ea7d9" />
                <Text style={[styles.steamNoteText, { color: themeColors.textMuted }]}>
                  {t('plat_steam_note', lang)}{' '}
                  <Text style={{ color: themeColors.accent }}>{t('plat_steam_note_link', lang)}</Text>.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.closeBtn, { backgroundColor: themeColors.accent }]}
                onPress={onClose}
                activeOpacity={0.85}
              >
                <Text style={styles.closeBtnText}>{t('plat_got_it', lang)}</Text>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            // Steam - should not reach here normally (Steam uses Settings API key flow)
            <View style={styles.infoContent}>
              <Text style={[styles.infoBody, { color: themeColors.textSecondary, textAlign: 'center' }]}>
                {t('plat_steam_configure', lang)}
              </Text>
              <TouchableOpacity
                style={[styles.closeBtn, { backgroundColor: themeColors.accent }]}
                onPress={onClose}
                activeOpacity={0.85}
              >
                <Text style={styles.closeBtnText}>{t('plat_close', lang)}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: 'hidden',
    maxHeight: '88%',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 99,
    alignSelf: 'center',
    marginTop: 14,
    marginBottom: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    marginTop: 1,
  },
  infoContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 14,
  },
  infoBox: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  infoBody: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  alternativeBox: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  altTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  altStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  altStepDot: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  altStepText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    paddingTop: 5,
  },
  steamNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  steamNoteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
  closeBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
