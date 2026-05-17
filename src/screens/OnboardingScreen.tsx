import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { setSetting } from '../database/queries';
import { t, Language } from '../i18n';
import { TutorialOverlay } from '../components/TutorialOverlay';
import { ED, MONO_FONT } from '../styles/editorial';

interface Props {
  onComplete: () => void;
}

const TOTAL_STEPS = 7;

export default function OnboardingScreen({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [lang, setLang] = useState<Language>('en');
  const [playerName, setPlayerName] = useState('');
  const [showTutorial, setShowTutorial] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const animateToStep = (next: number) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setStep(next), 160);
  };

  const goNext = () => { if (step < TOTAL_STEPS - 1) animateToStep(step + 1); };

  const handleComplete = () => {
    setSetting('onboarding_completed', 'true');
    setSetting('player_name', playerName.trim() || 'Player');
    setSetting('app_language', lang);
    onComplete();
  };

  const renderDots = () => {
    if (step === 0) return null;
    return (
      <View style={s.dotsRow}>
        {Array.from({ length: TOTAL_STEPS - 1 }).map((_, i) => (
          <View key={i} style={[s.dot, i === step - 1 && s.dotActive]} />
        ))}
      </View>
    );
  };

  const renderLanguageStep = () => (
    <View style={s.stepWrap}>
      <View style={s.iconRing}>
        <Ionicons name="globe-outline" size={26} color={ED.copper} />
      </View>
      <Text style={s.bigTitle}>{t('onb_lang_title', lang)}</Text>
      <Text style={s.sub}>{t('onb_lang_subtitle', lang)}</Text>
      <View style={s.langRow}>
        {(['en', 'es'] as Language[]).map((lc) => {
          const active = lang === lc;
          return (
            <TouchableOpacity
              key={lc}
              style={[s.langCard, active && s.langCardActive]}
              onPress={() => setLang(lc)}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 34 }}>{lc === 'en' ? '🇺🇸' : '🇲🇽'}</Text>
              <Text style={[s.langLabel, active && { color: ED.copper }]}>
                {t(lc === 'en' ? 'onb_lang_en' : 'onb_lang_es', lang)}
              </Text>
              {active && <Ionicons name="checkmark-circle" size={18} color={ED.copper} />}
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity style={s.cta} onPress={goNext} activeOpacity={0.85}>
        <Text style={s.ctaText}>{t('onb_lang_continue', lang)}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderWelcomeStep = () => (
    <ScrollView contentContainerStyle={s.stepWrap} showsVerticalScrollIndicator={false}>
      <View style={s.iconRing}>
        <Ionicons name="game-controller-outline" size={26} color={ED.copper} />
      </View>
      <Text style={s.bigTitle}>{t('onb_welcome_title', lang)}</Text>
      <View style={s.bodyCard}>
        <Text style={s.bodyText}>{t('onb_welcome_body', lang)}</Text>
      </View>
      <TouchableOpacity style={s.cta} onPress={goNext} activeOpacity={0.85}>
        <Text style={s.ctaText}>{t('onb_welcome_cta', lang)}</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const FEATURES = [
    { icon: 'sparkles' as const, color: ED.plum, titleKey: 'onb_feat_ai_title' as const, descKey: 'onb_feat_ai_desc' as const },
    { icon: 'time-outline' as const, color: ED.sky, titleKey: 'onb_feat_hltb_title' as const, descKey: 'onb_feat_hltb_desc' as const },
    { icon: 'stats-chart-outline' as const, color: ED.moss, titleKey: 'onb_feat_session_title' as const, descKey: 'onb_feat_session_desc' as const },
    { icon: 'calendar-outline' as const, color: ED.copper, titleKey: 'onb_feat_planner_title' as const, descKey: 'onb_feat_planner_desc' as const },
  ];

  const NEW_FEATURES = [
    { icon: 'wallet-outline' as const, color: ED.sky, titleKey: 'onb_feat_value_title' as const, descKey: 'onb_feat_value_desc' as const },
    { icon: 'flame-outline' as const, color: ED.rust, titleKey: 'onb_feat_shame_title' as const, descKey: 'onb_feat_shame_desc' as const },
    { icon: 'cart-outline' as const, color: ED.amber, titleKey: 'onb_feat_advisor_title' as const, descKey: 'onb_feat_advisor_desc' as const },
  ];

  const renderFeaturesStep = () => (
    <ScrollView contentContainerStyle={s.stepWrap} showsVerticalScrollIndicator={false}>
      <Text style={[s.bigTitle, { marginTop: 8 }]}>{t('onb_features_title', lang)}</Text>
      <View style={s.featGrid}>
        {FEATURES.map((f) => (
          <View key={f.titleKey} style={s.featCard}>
            <View style={[s.featIcon, { backgroundColor: f.color + '22' }]}>
              <Ionicons name={f.icon} size={20} color={f.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.featTitle}>{t(f.titleKey, lang)}</Text>
              <Text style={s.featDesc}>{t(f.descKey, lang)}</Text>
            </View>
          </View>
        ))}
      </View>
      <TouchableOpacity style={s.cta} onPress={goNext} activeOpacity={0.85}>
        <Text style={s.ctaText}>{t('onb_features_cta', lang)}</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderNewFeaturesStep = () => (
    <ScrollView contentContainerStyle={s.stepWrap} showsVerticalScrollIndicator={false}>
      <Text style={[s.bigTitle, { marginTop: 8 }]}>{t('onb_features2_title', lang)}</Text>
      <View style={s.featGrid}>
        {NEW_FEATURES.map((f) => (
          <View key={f.titleKey} style={s.featCard}>
            <View style={[s.featIcon, { backgroundColor: f.color + '22' }]}>
              <Ionicons name={f.icon} size={20} color={f.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.featTitle}>{t(f.titleKey, lang)}</Text>
              <Text style={s.featDesc}>{t(f.descKey, lang)}</Text>
            </View>
          </View>
        ))}
      </View>
      <TouchableOpacity style={s.cta} onPress={goNext} activeOpacity={0.85}>
        <Text style={s.ctaText}>{t('onb_features2_cta', lang)}</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderNameStep = () => (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.stepWrap}>
        <View style={[s.iconRing, { backgroundColor: ED.skyBg, borderColor: ED.sky + '44' }]}>
          <Ionicons name="person-circle-outline" size={26} color={ED.sky} />
        </View>
        <Text style={s.bigTitle}>{t('onb_name_title', lang)}</Text>
        <TextInput
          style={s.nameInput}
          placeholder={t('onb_name_placeholder', lang)}
          placeholderTextColor={ED.ink4}
          value={playerName}
          onChangeText={setPlayerName}
          autoCorrect={false}
          autoCapitalize="words"
          maxLength={32}
          returnKeyType="done"
          onSubmitEditing={goNext}
        />
        <TouchableOpacity style={s.cta} onPress={goNext} activeOpacity={0.85}>
          <Text style={s.ctaText}>{t('onb_name_cta', lang)}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={goNext} style={s.skipBtn}>
          <Text style={s.skipText}>{t('onb_name_skip', lang)}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

  const renderImportStep = () => (
    <ScrollView contentContainerStyle={s.stepWrap} showsVerticalScrollIndicator={false}>
      <View style={[s.iconRing, { backgroundColor: ED.amberBg, borderColor: ED.amber + '44' }]}>
        <Ionicons name="cloud-download-outline" size={26} color={ED.amber} />
      </View>
      <Text style={s.bigTitle}>{t('onb_import_title', lang)}</Text>
      <View style={s.bodyCard}>
        <Text style={s.bodyText}>{t('onb_import_body', lang)}</Text>
      </View>
      {/* Demo card */}
      <View style={s.demoCard}>
        <View style={s.demoHeader}>
          <Ionicons name="add-circle-outline" size={15} color={ED.copper} />
          <Text style={s.demoHeaderText}>{t('onb_import_manual_title', lang)}</Text>
        </View>
        <View style={s.demoSearch}>
          <Ionicons name="search-outline" size={13} color={ED.ink4} />
          <Text style={s.demoSearchText}>The Witcher 3</Text>
          <View style={s.cursor} />
        </View>
        <View style={s.demoSuggestion}>
          <View style={s.demoGameIcon}>
            <Ionicons name="game-controller-outline" size={13} color={ED.plum} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.demoGameTitle}>The Witcher 3: Wild Hunt</Text>
            <Text style={s.demoGameMeta}>PC  ·  ~50h  ·  RPG</Text>
          </View>
          <Ionicons name="checkmark-circle" size={15} color={ED.moss} />
        </View>
        <Text style={s.demoDesc}>{t('onb_import_manual_desc', lang)}</Text>
      </View>
      <TouchableOpacity style={s.cta} onPress={goNext} activeOpacity={0.85}>
        <Text style={s.ctaText}>{t('onb_import_cta', lang)}</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderTourStep = () => (
    <ScrollView contentContainerStyle={s.stepWrap} showsVerticalScrollIndicator={false}>
      <View style={[s.iconRing, { backgroundColor: ED.plumBg, borderColor: ED.plum + '44' }]}>
        <Ionicons name="map-outline" size={26} color={ED.plum} />
      </View>
      <Text style={s.bigTitle}>{t('onb_tour_title', lang)}</Text>
      <View style={s.bodyCard}>
        <Text style={s.bodyText}>{t('onb_tour_body', lang)}</Text>
      </View>
      <TouchableOpacity
        style={[s.cta, { backgroundColor: ED.plum, borderColor: ED.plum }]}
        onPress={() => setShowTutorial(true)}
        activeOpacity={0.85}
      >
        <Text style={s.ctaText}>{t('onb_tour_btn', lang)}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={handleComplete} style={s.skipBtn}>
        <Text style={s.skipText}>{t('onb_tour_skip', lang)}</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderStep = () => {
    switch (step) {
      case 0: return renderLanguageStep();
      case 1: return renderWelcomeStep();
      case 2: return renderFeaturesStep();
      case 3: return renderNewFeaturesStep();
      case 4: return renderNameStep();
      case 5: return renderImportStep();
      case 6: return renderTourStep();
      default: return null;
    }
  };

  return (
    <>
      <View style={s.root}>
        {/* Top accent rule */}
        <View style={s.topRule} />
        {renderDots()}
        <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>
          {renderStep()}
        </Animated.View>
      </View>

      <TutorialOverlay
        visible={showTutorial}
        lang={lang}
        onClose={() => { setShowTutorial(false); handleComplete(); }}
      />
    </>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: ED.bg },

  topRule: {
    height: 1,
    backgroundColor: ED.copperLine,
    marginBottom: 0,
  },

  dotsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6,
    paddingTop: Platform.OS === 'ios' ? 54 : 40,
    paddingBottom: 4,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: ED.ink4,
  },
  dotActive: { width: 20, backgroundColor: ED.copper },

  stepWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 28,
    gap: 18,
  },

  iconRing: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: ED.copperBg, borderWidth: 1, borderColor: ED.copperLine,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },

  bigTitle: {
    fontSize: 30, fontWeight: '800', letterSpacing: -1.2, lineHeight: 34,
    color: ED.ink, textAlign: 'center',
  },
  sub: {
    fontSize: 14, color: ED.ink3, textAlign: 'center', lineHeight: 20, marginTop: -6,
  },

  langRow: { flexDirection: 'row', gap: 12, alignSelf: 'stretch' },
  langCard: {
    flex: 1, alignItems: 'center', paddingVertical: 20,
    borderRadius: 14, borderWidth: 1, borderColor: ED.line,
    backgroundColor: ED.surface1, gap: 8,
  },
  langCardActive: { borderColor: ED.copperLine, backgroundColor: ED.copperBg },
  langLabel: { fontSize: 14, fontWeight: '600', color: ED.ink2 },

  cta: {
    alignSelf: 'stretch', height: 52, borderRadius: 14,
    backgroundColor: ED.copper,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 4,
  },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#1A1108' },
  skipBtn: { paddingVertical: 8, marginTop: -4 },
  skipText: { fontSize: 13, color: ED.ink3, textDecorationLine: 'underline' },

  bodyCard: {
    alignSelf: 'stretch',
    borderRadius: 14, borderWidth: 1, borderColor: ED.line,
    backgroundColor: ED.surface1, padding: 18,
  },
  bodyText: { fontSize: 14, color: ED.ink2, lineHeight: 22 },

  featGrid: { alignSelf: 'stretch', gap: 10 },
  featCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    borderRadius: 12, borderWidth: 1, borderColor: ED.line,
    backgroundColor: ED.surface1, padding: 14,
  },
  featIcon: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  featTitle: { fontSize: 13, fontWeight: '700', color: ED.ink, marginBottom: 3 },
  featDesc: { fontSize: 12, color: ED.ink3, lineHeight: 18 },

  nameInput: {
    alignSelf: 'stretch', height: 52,
    borderRadius: 14, borderWidth: 1.5, borderColor: ED.copperLine,
    backgroundColor: ED.surface1,
    paddingHorizontal: 18, fontSize: 16, fontWeight: '500', color: ED.ink,
  },

  demoCard: {
    alignSelf: 'stretch',
    borderRadius: 14, borderWidth: 1, borderColor: ED.line,
    backgroundColor: ED.surface1, padding: 16, gap: 10,
  },
  demoHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: ED.line,
  },
  demoHeaderText: { fontSize: 13, fontWeight: '700', color: ED.ink },
  demoSearch: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    borderRadius: 8, borderWidth: 1, borderColor: ED.copperLine,
    backgroundColor: ED.copperBg, paddingHorizontal: 10, paddingVertical: 9,
  },
  demoSearchText: { flex: 1, fontSize: 13, fontWeight: '500', color: ED.copper },
  cursor: { width: 2, height: 14, borderRadius: 1, backgroundColor: ED.copper, opacity: 0.8 },
  demoSuggestion: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 8, borderWidth: 1, borderColor: ED.line,
    backgroundColor: ED.surface2, padding: 10,
  },
  demoGameIcon: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: ED.plumBg, alignItems: 'center', justifyContent: 'center',
  },
  demoGameTitle: { fontSize: 12, fontWeight: '600', color: ED.ink },
  demoGameMeta: { fontSize: 11, color: ED.ink3, marginTop: 1 },
  demoDesc: { fontSize: 12, color: ED.ink3, lineHeight: 18 },
});
