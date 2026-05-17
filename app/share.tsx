import React, { useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Image } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '../src/hooks/useAppContext';
import { t, Language } from '../src/i18n';
import { useGames } from '../src/hooks/useGames';
import { BacklogStats, Game } from '../src/types';
import { getSetting } from '../src/database/queries';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMostPlayedGame(games: Game[]): Game | null {
    if (!games || games.length === 0) return null;
    const withPlaytime = games.filter((g) => g.playtime_minutes > 0);
    if (withPlaytime.length === 0) {
        const completed = games.find((g) => g.status === 'completed' && g.cover_url);
        if (completed) return completed;
        return games.find((g) => g.cover_url) ?? null;
    }
    return withPlaytime.reduce((best, g) => (g.playtime_minutes > best.playtime_minutes ? g : best));
}

function formatHours(minutes: number): string {
    return `${Math.round(minutes / 60)}h`;
}

// ─── Shame logic ─────────────────────────────────────────────────────────────

function computeShame(stats: BacklogStats): number {
    const backlog = stats.not_started + stats.up_next + stats.paused + stats.playing;
    let shame = stats.total > 0 ? Math.round((backlog / stats.total) * 100) : 0;
    if (stats.total > 100) shame = Math.min(100, shame + 15);
    else if (stats.total > 50) shame = Math.min(100, shame + 8);
    if (stats.total_hours_remaining > 500) shame = Math.min(100, shame + 10);
    else if (stats.total_hours_remaining > 200) shame = Math.min(100, shame + 5);
    return Math.max(5, Math.min(100, shame));
}

function getVerdict(shame: number, stats: BacklogStats, lang: Language): string {
    const finishYear = new Date().getFullYear() + Math.ceil(stats.total_hours_remaining / 365);

    const tiers: Array<{ min: number; en: string; es: string }> = [
        {
            min: 0,
            en: "You're suspiciously functional.\nAre you okay?",
            es: 'Eres sospechosamente funcional.\n¿Estás bien?',
        },
        {
            min: 20,
            en: 'A healthy backlog.\nA lie you tell yourself.',
            es: 'Un backlog saludable.\nUna mentira que te dices.',
        },
        {
            min: 40,
            en: 'The backlog grows.\nSteam sales were a mistake.',
            es: 'El backlog crece.\nLas ofertas de Steam fueron un error.',
        },
        {
            min: 55,
            en: 'Certified game hoarder.',
            es: 'Acumulador certificado de juegos.',
        },
        {
            min: 68,
            en: "Your backlog is a\nsmall country's GDP.",
            es: 'Tu backlog equivale\nal PIB de un país pequeño.',
        },
        {
            min: 80,
            en: `You could finish your backlog\nin ${finishYear}. Good luck.`,
            es: `Podrías terminar tu backlog\nen ${finishYear}. Buena suerte.`,
        },
        {
            min: 92,
            en: 'Steam therapist recommended.\nImmediately.',
            es: 'Se recomienda terapeuta de Steam.\nInmediatamente.',
        },
    ];

    let verdict = tiers[0];
    for (const tier of tiers) {
        if (shame >= tier.min) verdict = tier;
    }
    return lang === 'es' ? verdict.es : verdict.en;
}

function shameBar(shame: number): string {
    const filled = Math.round(shame / 5);
    const empty = 20 - filled;
    return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, empty));
}

// ─── Library value helpers ────────────────────────────────────────────────────

function computeLibraryValue(games: Game[]) {
    const priced = games.filter((g) => g.price_cents && g.price_cents > 0);
    const totalCents = priced.reduce((s, g) => s + (g.price_cents ?? 0), 0);
    const avgCents = priced.length > 0 ? Math.round(totalCents / priced.length) : 0;
    const mostExp = priced.length > 0
        ? priced.reduce((best, g) => ((g.price_cents ?? 0) > (best.price_cents ?? 0) ? g : best))
        : null;
    return { priced, totalCents, avgCents, mostExp };
}

function formatCents(cents: number, currency: string): string {
    const amount = cents / 100;
    if (currency === 'mxn') return `$${Math.round(amount)} MXN`;
    return `$${amount.toFixed(2)} USD`;
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ShareProfileScreen() {
    const { themeColors } = useAppContext();
    const { language = 'en', playerName = 'Player' } = useAppContext() as any;
    const lang = language as Language;
    const { games, stats, loading, refresh } = useGames();
    const profileRef = useRef<ViewShot>(null);
    const shameRef = useRef<ViewShot>(null);
    const libraryRef = useRef<ViewShot>(null);
    const [sharingProfile, setSharingProfile] = useState(false);
    const [sharingShame, setSharingShame] = useState(false);
    const [sharingLibrary, setSharingLibrary] = useState(false);
    const currency = getSetting('currency') ?? 'usd';

    useFocusEffect(
        useCallback(() => {
            refresh();
        }, [refresh])
    );

    if (loading || !stats) {
        return (
            <View style={[styles.root, { backgroundColor: themeColors.bg, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={themeColors.accent} />
            </View>
        );
    }

    const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
    const mostPlayed = getMostPlayedGame(games);
    const shame = computeShame(stats);
    const verdict = getVerdict(shame, stats, lang);
    const bar = shameBar(shame);
    const { priced, totalCents, avgCents, mostExp } = computeLibraryValue(games);
    const hoursPerUnit = totalCents > 0
        ? (stats.total_playtime_hours / (totalCents / 100)).toFixed(1)
        : null;

    const captureAndShare = async (ref: React.RefObject<ViewShot>, dialogTitle: string, onBusy: (v: boolean) => void) => {
        if (!ref.current?.capture) return;
        onBusy(true);
        try {
            const uri = await ref.current.capture();
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, { dialogTitle, mimeType: 'image/png' });
            } else {
                Alert.alert(t('share_err_unavail', lang), t('share_err_unavail_msg', lang));
            }
        } catch (e) {
            Alert.alert(t('share_err_fail', lang), t('share_err_fail_msg', lang));
            console.error(e);
        } finally {
            onBusy(false);
        }
    };

    return (
        <View style={[styles.root, { backgroundColor: themeColors.bg }]}>
            <LinearGradient colors={[themeColors.bg, themeColors.card]} style={StyleSheet.absoluteFill} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={themeColors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: themeColors.textPrimary }]}>{t('share_title', lang)}</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>

                {/* ── Profile Card ─────────────────────────── */}
                <ViewShot ref={profileRef} options={{ format: 'png', quality: 0.95 }}>
                    <View style={[styles.cardContainer, { backgroundColor: themeColors.bg }]}>
                        {/* Hero */}
                        <View style={styles.heroWrap}>
                            {mostPlayed?.cover_url ? (
                                <Image source={{ uri: mostPlayed.cover_url }} style={styles.heroCover} resizeMode="cover" />
                            ) : null}
                            <LinearGradient colors={['transparent', themeColors.bg]} style={styles.heroOverlay} />
                            <LinearGradient
                                colors={[themeColors.accent + '55', themeColors.violet + '33']}
                                style={[StyleSheet.absoluteFill, { opacity: mostPlayed?.cover_url ? 0.4 : 1 }]}
                            />
                        </View>

                        {/* Profile header */}
                        <View style={styles.profileSection}>
                            <View style={[styles.avatar, { backgroundColor: themeColors.accent + '22', borderColor: themeColors.accent }]}>
                                <Ionicons name="game-controller" size={28} color={themeColors.accent} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.playerName, { color: themeColors.textPrimary }]}>
                                    {playerName}
                                </Text>
                            </View>
                        </View>

                        {/* Most Played */}
                        {mostPlayed && (
                            <View style={[styles.spotlightCard, { backgroundColor: themeColors.card, borderColor: themeColors.glassBorder }]}>
                                <Text style={[styles.spotlightLabel, { color: themeColors.textMuted }]}>{t('share_most_played', lang)}</Text>
                                <View style={styles.spotlightRow}>
                                    {mostPlayed.cover_url ? (
                                        <Image source={{ uri: mostPlayed.cover_url }} style={styles.spotlightCover} resizeMode="cover" />
                                    ) : (
                                        <View style={[styles.spotlightCoverFallback, { backgroundColor: themeColors.accent + '33' }]}>
                                            <Ionicons name="game-controller" size={20} color={themeColors.accent} />
                                        </View>
                                    )}
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.spotlightTitle, { color: themeColors.textPrimary }]} numberOfLines={2}>
                                            {mostPlayed.title}
                                        </Text>
                                        {mostPlayed.playtime_minutes > 0 && (
                                            <Text style={[styles.spotlightHours, { color: themeColors.accent }]}>
                                                {formatHours(mostPlayed.playtime_minutes)} {t('share_played', lang)}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            </View>
                        )}

                        {/* Stats grid */}
                        <View style={styles.statsGrid}>
                            {[
                                { value: stats.completed, label: t('share_completed', lang), color: themeColors.accent },
                                { value: stats.total, label: t('share_total', lang), color: themeColors.green },
                                { value: `${stats.total_playtime_hours}h`, label: t('share_playtime', lang), color: themeColors.violet },
                                { value: `${completionRate}%`, label: t('share_win_rate', lang), color: themeColors.teal },
                            ].map(({ value, label, color }) => (
                                <View key={label} style={[styles.statBox, { backgroundColor: themeColors.glassBorder }]}>
                                    <Text style={[styles.statValue, { color }]}>{value}</Text>
                                    <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>{label}</Text>
                                </View>
                            ))}
                        </View>

                        <View style={styles.footer}>
                            <Text style={[styles.footerText, { color: themeColors.textMuted }]}>
                                {t('share_generated', lang)}
                            </Text>
                        </View>
                    </View>
                </ViewShot>

                <TouchableOpacity
                    style={[styles.shareBtn, { backgroundColor: themeColors.accent }]}
                    onPress={() => captureAndShare(profileRef, t('share_dialog_title', lang), setSharingProfile)}
                    disabled={sharingProfile}
                >
                    {sharingProfile ? (
                        <><ActivityIndicator color="#fff" /><Text style={styles.shareText}>{t('share_capturing', lang)}</Text></>
                    ) : (
                        <><Ionicons name="share-social" size={20} color="#fff" /><Text style={styles.shareText}>{t('share_share_btn', lang)}</Text></>
                    )}
                </TouchableOpacity>

                {/* ── Shame Meter ──────────────────────────── */}
                <View style={styles.shameSectionHeader}>
                    <Text style={[styles.shameSectionTitle, { color: themeColors.textPrimary }]}>
                        {t('shame_section_title', lang)}
                    </Text>
                    <Text style={[styles.shameSectionSub, { color: themeColors.textMuted }]}>
                        {t('shame_section_sub', lang)}
                    </Text>
                </View>

                <ViewShot ref={shameRef} options={{ format: 'png', quality: 0.95 }}>
                    <View style={styles.shameCard}>
                        {/* Deep dark background */}
                        <LinearGradient colors={['#0a0208', '#130510', '#0a0a14']} style={StyleSheet.absoluteFill} />
                        {/* Fire glow at top */}
                        <LinearGradient
                            colors={['#ff430033', '#ff6b3511', 'transparent']}
                            style={styles.shameGlow}
                        />

                        {/* Flame icon + title */}
                        <Text style={styles.shameFlame}>🔥</Text>
                        <Text style={styles.shameCardTitle}>BACKLOG SHAME METER</Text>
                        <Text style={styles.shamePlayerName}>{playerName}</Text>

                        {/* Progress bar */}
                        <View style={styles.shameBarSection}>
                            <Text style={styles.shameLevelLabel}>{t('shame_level_label', lang)}</Text>
                            <Text style={styles.shameBarChars}>{bar}</Text>
                            <Text style={styles.shamePct}>{shame}%</Text>
                        </View>

                        {/* Verdict box */}
                        <View style={styles.verdictBox}>
                            <Text style={styles.verdictLabel}>{t('shame_verdict_label', lang)}</Text>
                            <Text style={styles.verdictText}>{verdict}</Text>
                        </View>

                        {/* Mini stats */}
                        <View style={styles.shameStatsRow}>
                            {[
                                { val: stats.total, lbl: t('shame_stat_games', lang) },
                                { val: stats.completed, lbl: t('shame_stat_finished', lang) },
                                { val: `${stats.total_hours_remaining}h`, lbl: t('shame_stat_remaining', lang) },
                            ].map(({ val, lbl }) => (
                                <View key={lbl} style={styles.shameStat}>
                                    <Text style={styles.shameStatVal}>{val}</Text>
                                    <Text style={styles.shameStatLbl}>{lbl}</Text>
                                </View>
                            ))}
                        </View>

                        {/* Footer */}
                        <Text style={styles.shameFooter}>{t('shame_footer', lang)}</Text>
                    </View>
                </ViewShot>

                <TouchableOpacity
                    style={[styles.shareBtn, styles.shamShareBtn]}
                    onPress={() => captureAndShare(shameRef, t('shame_share_btn', lang), setSharingShame)}
                    disabled={sharingShame}
                >
                    {sharingShame ? (
                        <><ActivityIndicator color="#fff" /><Text style={styles.shareText}>{t('share_capturing', lang)}</Text></>
                    ) : (
                        <><Text style={styles.shameShareIcon}>🔥</Text><Text style={styles.shareText}>{t('shame_share_btn', lang)}</Text></>
                    )}
                </TouchableOpacity>

                {/* ── Library Value Card ───────────────────── */}
                <View style={styles.shameSectionHeader}>
                    <Text style={[styles.shameSectionTitle, { color: themeColors.textPrimary }]}>
                        {t('share_library_value_title', lang)} 💰
                    </Text>
                    <Text style={[styles.shameSectionSub, { color: themeColors.textMuted }]}>
                        {t('share_library_value_sub', lang)}
                    </Text>
                </View>

                <ViewShot ref={libraryRef} options={{ format: 'png', quality: 0.95 }}>
                    <View style={[styles.libraryCard, { backgroundColor: themeColors.card }]}>
                        <LinearGradient
                            colors={[themeColors.teal + '22', themeColors.violet + '11', themeColors.card]}
                            style={StyleSheet.absoluteFill}
                        />
                        {priced.length === 0 ? (
                            <View style={styles.libraryEmpty}>
                                <Ionicons name="wallet-outline" size={40} color={themeColors.textMuted} />
                                <Text style={[styles.libraryEmptyText, { color: themeColors.textMuted }]}>
                                    {t('share_library_no_prices', lang)}
                                </Text>
                            </View>
                        ) : (
                            <>
                                {/* Total value hero */}
                                <View style={styles.libraryHero}>
                                    <Text style={[styles.libraryHeroLabel, { color: themeColors.textMuted }]}>
                                        {t('share_library_value', lang).toUpperCase()}
                                    </Text>
                                    <Text style={[styles.libraryHeroValue, { color: themeColors.teal }]}>
                                        {formatCents(totalCents, currency)}
                                    </Text>
                                    <Text style={[styles.libraryHeroSub, { color: themeColors.textSecondary }]}>
                                        {priced.length} {t('share_priced_games', lang)}
                                    </Text>
                                </View>

                                {/* Stats row */}
                                <View style={styles.libraryStatsRow}>
                                    <View style={[styles.libraryStatBox, { backgroundColor: themeColors.glassBorder }]}>
                                        <Text style={[styles.libraryStatVal, { color: themeColors.accent }]}>
                                            {formatCents(avgCents, currency)}
                                        </Text>
                                        <Text style={[styles.libraryStatLbl, { color: themeColors.textSecondary }]}>
                                            {t('share_avg_price', lang)}
                                        </Text>
                                    </View>
                                    {hoursPerUnit && (
                                        <View style={[styles.libraryStatBox, { backgroundColor: themeColors.glassBorder }]}>
                                            <Text style={[styles.libraryStatVal, { color: themeColors.violet }]}>
                                                {hoursPerUnit}h
                                            </Text>
                                            <Text style={[styles.libraryStatLbl, { color: themeColors.textSecondary }]}>
                                                {t('share_hours_per_dollar', lang)}
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                {/* Most expensive */}
                                {mostExp && (
                                    <View style={[styles.libraryMostExp, { borderColor: themeColors.glassBorder }]}>
                                        <Text style={[styles.libraryMostExpLabel, { color: themeColors.textMuted }]}>
                                            {t('share_most_exp', lang).toUpperCase()}
                                        </Text>
                                        <View style={styles.libraryMostExpRow}>
                                            {mostExp.cover_url ? (
                                                <Image source={{ uri: mostExp.cover_url }} style={styles.libraryMostExpCover} resizeMode="cover" />
                                            ) : null}
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.libraryMostExpTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
                                                    {mostExp.title}
                                                </Text>
                                                <Text style={[styles.libraryMostExpPrice, { color: themeColors.teal }]}>
                                                    {formatCents(mostExp.price_cents ?? 0, currency)}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                )}

                                {/* Player + footer */}
                                <View style={styles.libraryFooterRow}>
                                    <Text style={[styles.libraryPlayerName, { color: themeColors.textSecondary }]}>
                                        {playerName}
                                    </Text>
                                    <Text style={[styles.libraryFooter, { color: themeColors.textMuted }]}>
                                        {t('share_value_card_footer', lang)}
                                    </Text>
                                </View>
                            </>
                        )}
                    </View>
                </ViewShot>

                <TouchableOpacity
                    style={[styles.shareBtn, { backgroundColor: themeColors.teal }]}
                    onPress={() => captureAndShare(libraryRef, t('share_library_value_title', lang), setSharingLibrary)}
                    disabled={sharingLibrary || priced.length === 0}
                >
                    {sharingLibrary ? (
                        <><ActivityIndicator color="#fff" /><Text style={styles.shareText}>{t('share_capturing', lang)}</Text></>
                    ) : (
                        <><Ionicons name="wallet-outline" size={20} color="#fff" /><Text style={styles.shareText}>{t('share_library_value_title', lang)}</Text></>
                    )}
                </TouchableOpacity>

                <View style={{ height: 60 }} />
            </ScrollView>
        </View>
    );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    root: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
        zIndex: 10,
    },
    backBtn: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    title: { fontSize: 20, fontWeight: '700' },
    scroll: { padding: 20 },

    // ── Profile card ────────────────────────────────────────────
    cardContainer: {
        borderRadius: 24,
        overflow: 'hidden',
        marginBottom: 16,
    },
    heroWrap: { height: 160, position: 'relative', overflow: 'hidden' },
    heroCover: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
    heroOverlay: { ...StyleSheet.absoluteFillObject },
    profileSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 12,
    },
    avatar: {
        width: 52, height: 52, borderRadius: 26, borderWidth: 2,
        alignItems: 'center', justifyContent: 'center',
    },
    playerName: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
    proBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
    proText: { color: '#fff', fontSize: 10, fontWeight: '800' },
    spotlightCard: {
        marginHorizontal: 20, marginBottom: 16, borderRadius: 16, borderWidth: 1, padding: 14,
    },
    spotlightLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 10 },
    spotlightRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    spotlightCover: { width: 52, height: 68, borderRadius: 8 },
    spotlightCoverFallback: {
        width: 52, height: 68, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    },
    spotlightTitle: { fontSize: 15, fontWeight: '700', marginBottom: 6, lineHeight: 20 },
    spotlightHours: { fontSize: 14, fontWeight: '800' },
    statsGrid: {
        flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
        gap: 10, paddingHorizontal: 20, paddingBottom: 20,
    },
    statBox: { width: '46%', paddingVertical: 14, paddingHorizontal: 6, borderRadius: 16, alignItems: 'center' },
    statValue: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
    statLabel: { fontSize: 12, fontWeight: '600' },
    footer: {
        alignItems: 'center', paddingVertical: 14,
        borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', marginHorizontal: 20,
    },
    footerText: { fontSize: 12, fontWeight: '500' },

    // ── Buttons ─────────────────────────────────────────────────
    shareBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, height: 56, borderRadius: 16, marginBottom: 32,
    },
    shamShareBtn: { backgroundColor: '#c0392b' },
    shareText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    shameShareIcon: { fontSize: 20 },

    // ── Shame section header ─────────────────────────────────────
    shameSectionHeader: { marginBottom: 16 },
    shameSectionTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
    shameSectionSub: { fontSize: 13, marginTop: 3 },

    // ── Shame card ───────────────────────────────────────────────
    shameCard: {
        borderRadius: 24,
        overflow: 'hidden',
        padding: 28,
        marginBottom: 16,
        alignItems: 'center',
    },
    shameGlow: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 200,
    },
    shameFlame: { fontSize: 48, marginBottom: 6 },
    shameCardTitle: {
        color: '#ff6535',
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 3,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    shamePlayerName: {
        color: '#f0f0f0',
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 24,
    },
    shameBarSection: { width: '100%', alignItems: 'center', marginBottom: 24 },
    shameLevelLabel: {
        color: '#a0a0b8',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginBottom: 10,
    },
    shameBarChars: {
        color: '#ff4500',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 1,
        fontVariant: ['tabular-nums'],
    },
    shamePct: {
        color: '#ff6535',
        fontSize: 40,
        fontWeight: '900',
        marginTop: 4,
        letterSpacing: -1,
    },
    verdictBox: {
        width: '100%',
        backgroundColor: 'rgba(255,69,0,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,69,0,0.25)',
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        marginBottom: 24,
    },
    verdictLabel: {
        color: '#ff6535',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    verdictText: {
        color: '#f0f0f0',
        fontSize: 18,
        fontWeight: '800',
        textAlign: 'center',
        lineHeight: 26,
    },
    shameStatsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        marginBottom: 24,
    },
    shameStat: { alignItems: 'center' },
    shameStatVal: { color: '#f0f0f0', fontSize: 20, fontWeight: '900' },
    shameStatLbl: { color: '#606078', fontSize: 11, fontWeight: '600', marginTop: 2 },
    shameFooter: {
        color: '#404060',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },

    // ── Library Value card ───────────────────────────────────────
    libraryCard: {
        borderRadius: 24,
        overflow: 'hidden',
        padding: 24,
        marginBottom: 16,
    },
    libraryEmpty: {
        alignItems: 'center',
        paddingVertical: 32,
        gap: 12,
    },
    libraryEmptyText: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    libraryHero: {
        alignItems: 'center',
        marginBottom: 20,
    },
    libraryHeroLabel: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 2,
        marginBottom: 6,
    },
    libraryHeroValue: {
        fontSize: 44,
        fontWeight: '900',
        letterSpacing: -1,
    },
    libraryHeroSub: {
        fontSize: 13,
        fontWeight: '500',
        marginTop: 4,
    },
    libraryStatsRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    libraryStatBox: {
        flex: 1,
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 8,
        alignItems: 'center',
    },
    libraryStatVal: {
        fontSize: 20,
        fontWeight: '800',
        marginBottom: 3,
    },
    libraryStatLbl: {
        fontSize: 11,
        fontWeight: '600',
        textAlign: 'center',
    },
    libraryMostExp: {
        borderTopWidth: 1,
        paddingTop: 14,
        marginBottom: 14,
    },
    libraryMostExpLabel: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1.5,
        marginBottom: 8,
    },
    libraryMostExpRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    libraryMostExpCover: {
        width: 40,
        height: 52,
        borderRadius: 6,
    },
    libraryMostExpTitle: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 3,
    },
    libraryMostExpPrice: {
        fontSize: 16,
        fontWeight: '800',
    },
    libraryFooterRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.07)',
        paddingTop: 12,
        marginTop: 4,
    },
    libraryPlayerName: {
        fontSize: 13,
        fontWeight: '700',
    },
    libraryFooter: {
        fontSize: 11,
        fontWeight: '500',
    },
});
