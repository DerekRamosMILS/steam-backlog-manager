import React, { Component, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';
import { useDatabase } from '../src/hooks/useDatabase';
import { AppProvider } from '../src/hooks/useAppContext';
import { getSetting } from '../src/database/queries';
import OnboardingScreen from '../src/screens/OnboardingScreen';
import { t, Language } from '../src/i18n';
import { ED } from '../src/styles/editorial';

// ─── Error Boundary ───────────────────────────────────────────────────────────

interface ErrorState { hasError: boolean; message: string }

class ErrorBoundary extends Component<{ children: React.ReactNode }, ErrorState> {
  state: ErrorState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): ErrorState {
    return { hasError: true, message: error.message ?? 'Unknown error' };
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const lang = (getSetting('language') as Language) || 'en';
    return (
      <View style={ebStyles.root}>
        <Text style={ebStyles.icon}>⚠️</Text>
        <Text style={ebStyles.title}>{t('eb_title', lang)}</Text>
        <Text style={ebStyles.msg}>{this.state.message}</Text>
        <TouchableOpacity
          style={ebStyles.btn}
          onPress={() => this.setState({ hasError: false, message: '' })}
        >
          <Text style={ebStyles.btnText}>{t('eb_btn', lang)}</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const ebStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: ED.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  icon: { fontSize: 52 },
  title: { color: ED.ink, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  msg: { color: ED.ink3, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  btn: {
    backgroundColor: ED.copper,
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 8,
  },
  btnText: { color: '#1A1108', fontSize: 15, fontWeight: '700' },
});

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { ready } = useDatabase();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    if (ready) {
      const done = getSetting('onboarding_completed') === 'true';
      setOnboardingDone(done);
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready || onboardingDone === null) {
    return null;
  }

  if (!onboardingDone) {
    return (
      <ErrorBoundary>
        <AppProvider>
          <StatusBar style="light" />
          <OnboardingScreen onComplete={() => setOnboardingDone(true)} />
        </AppProvider>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <AppProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: ED.bg },
            animation: 'fade_from_bottom',
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="game/[id]"
            options={{
              headerShown: false,
              animation: 'slide_from_right',
              presentation: 'card',
            }}
          />
        </Stack>
      </AppProvider>
    </ErrorBoundary>
  );
}
