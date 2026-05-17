import React, { createContext, useContext, useEffect, useState } from 'react';
import { getAllSettings, setSetting, getSetting } from '../database/queries';
import { Theme } from '../types';
import { THEMES, ThemeColors } from '../services/themeService';
import { useDatabase } from './useDatabase';
import { Language } from '../i18n';

// ─── Context shape ─────────────────────────────────────────────────────────────

interface AppContextState {
    // ── Theme ─────────────────────────────────────────────────────────────────
    theme: Theme;
    themeColors: ThemeColors;
    setTheme: (t: Theme) => void;
    refreshSettings: () => void;
    // ── Localization / Player ─────────────────────────────────────────────────
    language: Language;
    setLanguage: (lang: Language) => void;
    playerName: string;
    setPlayerName: (name: string) => void;
}

const AppContext = createContext<AppContextState>({
    theme: 'dark',
    themeColors: THEMES.dark,
    setTheme: () => {},
    refreshSettings: () => {},
    language: 'en',
    setLanguage: () => {},
    playerName: 'Player',
    setPlayerName: () => {},
});

// ─── Provider ──────────────────────────────────────────────────────────────────

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { ready } = useDatabase();
    const [theme, setThemeState] = useState<Theme>('dark');
    const [language, setLanguageState] = useState<Language>('en');
    const [playerName, setPlayerNameState] = useState('Player');

    // ── Settings refresh ───────────────────────────────────────────────────────

    const refreshSettings = () => {
        if (!ready) return;
        const settings = getAllSettings();
        setThemeState(settings.theme || 'dark');
        const storedLang = getSetting('app_language');
        if (storedLang === 'en' || storedLang === 'es') setLanguageState(storedLang as Language);
        const storedName = getSetting('player_name');
        if (storedName) setPlayerNameState(storedName);
    };

    // ── Initialization ─────────────────────────────────────────────────────────

    useEffect(() => {
        if (!ready) return;
        refreshSettings();
    }, [ready]);

    // ── Theme ──────────────────────────────────────────────────────────────────

    const setTheme = (t: Theme) => {
        setSetting('theme', t);
        setThemeState(t);
    };

    const setLanguage = (lang: Language) => {
        setSetting('app_language', lang);
        setLanguageState(lang);
    };

    const setPlayerName = (name: string) => {
        setSetting('player_name', name);
        setPlayerNameState(name);
    };

    // ── Derived values ─────────────────────────────────────────────────────────

    const themeColors = THEMES[theme] || THEMES.dark;

    return (
        <AppContext.Provider
            value={{
                theme,
                themeColors,
                setTheme,
                refreshSettings,
                language,
                setLanguage,
                playerName,
                setPlayerName,
            }}
        >
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => useContext(AppContext);
