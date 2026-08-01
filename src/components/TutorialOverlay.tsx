import React, { useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../hooks/useAppContext';
import { t, Language } from '../i18n';
import { setSetting } from '../database/queries';


interface TutorialStep {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  titleKey: keyof typeof import('../i18n').STRINGS;
  descKey: keyof typeof import('../i18n').STRINGS;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Override language — useful during onboarding before the setting is saved */
  lang?: Language;
}

export function TutorialOverlay({ visible, onClose, lang: langProp }: Props) {
  const { themeColors, language } = useAppContext();
  const lang = (langProp ?? language) as Language;
  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const STEPS: TutorialStep[] = [
    {
      icon: 'home-outline',
      color: themeColors.accent,
      titleKey: 'tutorial_step_home_title',
      descKey: 'tutorial_step_home_desc',
    },
    {
      icon: 'library-outline',
      color: themeColors.teal,
      titleKey: 'tutorial_step_library_title',
      descKey: 'tutorial_step_library_desc',
    },
    {
      icon: 'sparkles',
      color: themeColors.violet,
      titleKey: 'tutorial_step_ai_title',
      descKey: 'tutorial_step_ai_desc',
    },
    {
      icon: 'calendar-outline',
      color: themeColors.orange,
      titleKey: 'tutorial_step_planner_title',
      descKey: 'tutorial_step_planner_desc',
    },
    {
      icon: 'stats-chart-outline',
      color: themeColors.green,
      titleKey: 'tutorial_step_stats_title',
      descKey: 'tutorial_step_stats_desc',
    },
    {
      icon: 'share-social-outline',
      color: themeColors.blue,
      titleKey: 'tutorial_step_share_title',
      descKey: 'tutorial_step_share_desc',
    },
    {
      icon: 'cart-outline',
      color: '#f97316',
      titleKey: 'tutorial_step_advisor_title',
      descKey: 'tutorial_step_advisor_desc',
    },
    {
      icon: 'settings-outline',
      color: themeColors.textSecondary,
      titleKey: 'tutorial_step_settings_title',
      descKey: 'tutorial_step_settings_desc',
    },
  ];

  const animateToStep = (next: number) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setStep(next), 140);
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      animateToStep(step + 1);
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    setSetting('tutorial_completed', 'true');
    setStep(0);
    onClose();
  };

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      {/* Blurred dark backdrop */}
      <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.75)']}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.root}>
        {/* Header row */}
        <View style={styles.header}>
          <Text style={[styles.tourLabel, { color: themeColors.textMuted }]}>
            {t('tutorial_title', lang)}
          </Text>
          <TouchableOpacity onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={[styles.skipText, { color: themeColors.textMuted }]}>
              {t('tutorial_skip', lang)}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Dots */}
        <View style={styles.dotsRow}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === step ? current.color : themeColors.glassBorder,
                  width: i === step ? 22 : 7,
                },
              ]}
            />
          ))}
        </View>

        {/* Step card */}
        <Animated.View style={{ opacity: fadeAnim, flex: 1, justifyContent: 'center' }}>
          <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.glassBorder }]}>
            {/* Colored accent gradient */}
            <LinearGradient
              colors={[current.color + '22', 'transparent']}
              style={StyleSheet.absoluteFill}
            />

            {/* Icon */}
            <View style={[styles.iconCircle, { backgroundColor: current.color + '22', borderColor: current.color + '55' }]}>
              <Ionicons name={current.icon} size={40} color={current.color} />
            </View>

            {/* Step counter */}
            <Text style={[styles.stepCounter, { color: current.color }]}>
              {step + 1} / {STEPS.length}
            </Text>

            {/* Title */}
            <Text style={[styles.title, { color: themeColors.textPrimary }]}>
              {t(current.titleKey as any, lang)}
            </Text>

            {/* Description */}
            <Text style={[styles.desc, { color: themeColors.textSecondary }]}>
              {t(current.descKey as any, lang)}
            </Text>
          </View>
        </Animated.View>

        {/* Next / Done button */}
        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: current.color }]}
          onPress={handleNext}
          activeOpacity={0.85}
        >
          <Text style={styles.nextText}>
            {isLast ? t('tutorial_done', lang) : t('tutorial_next', lang)}
          </Text>
          {!isLast && <Ionicons name="arrow-forward" size={18} color="#fff" />}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 48,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tourLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 20,
  },
  dot: {
    height: 7,
    borderRadius: 4,
  },
  card: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    overflow: 'hidden',
    gap: 16,
    marginVertical: 24,
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepCounter: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  desc: {
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 58,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  nextText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
