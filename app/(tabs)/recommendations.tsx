import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Switch,
    ActivityIndicator,
    TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { GlassCard } from '../../src/components/GlassCard';
import { SectionHeader } from '../../src/components/SectionHeader';
import { GameCard } from '../../src/components/GameCard';
import { useAppContext } from '../../src/hooks/useAppContext';
import { t } from '../../src/i18n';
import {
    BacklogMission,
    DailyPick,
    Recommendation,
    RecommendationGoal,
    RecommendationMood,
    SmartCollection,
    TasteProfile,
    VersusPair,
    WeeklyPlan,
} from '../../src/types';
import {
    getBacklogMissions,
    getDailyPick,
    getRecommendations,
    getSmartCollections,
    getTasteProfile,
    getVersusPair,
    getWeeklyPlan,
    recordVersusChoice,
    isAiProfileInitialized,
} from '../../src/services/recommendationService';
import { trackEvent } from '../../src/services/analyticsService';

import { Language } from '../../src/i18n';

function getMoodOptions(lang: Language): { label: string; value: RecommendationMood }[] {
    return [
        { label: t('ai_mood_balanced', lang), value: 'balanced' },
        { label: t('ai_mood_advance', lang), value: 'advance' },
        { label: t('ai_mood_short', lang), value: 'short' },
        { label: t('ai_mood_chill', lang), value: 'chill' },
        { label: t('ai_mood_resume', lang), value: 'resume' },
        { label: t('ai_mood_finish', lang), value: 'finish' },
    ];
}

function getSessionOptions(lang: Language): { label: string; value: number | undefined }[] {
    return [
        { label: t('ai_session_any', lang), value: undefined },
        { label: t('ai_session_1h', lang), value: 1 },
        { label: t('ai_session_2h', lang), value: 2 },
        { label: t('ai_session_4h', lang), value: 4 },
    ];
}

function getGoalOptions(lang: Language): { label: string; value: RecommendationGoal }[] {
    return [
        { label: t('ai_goal_any', lang), value: 'none' },
        { label: t('ai_goal_finish_today', lang), value: 'finish_today' },
        { label: t('ai_goal_2sessions', lang), value: 'two_sessions' },
        { label: t('ai_goal_bite', lang), value: 'bite_size' },
    ];
}

export default function RecommendationsScreen() {
    const router = useRouter();
    const { themeColors } = useAppContext();
    const { language = 'en' } = useAppContext() as any;
    const MOOD_OPTIONS = getMoodOptions(language as Language);
    const SESSION_OPTIONS = getSessionOptions(language as Language);
    const GOAL_OPTIONS = getGoalOptions(language as Language);
    const [focusMode, setFocusMode] = useState(false);
    const [sessionHours, setSessionHours] = useState<number | undefined>(undefined);
    const [mood, setMood] = useState<RecommendationMood>('balanced');
    const [goal, setGoal] = useState<RecommendationGoal>('none');
    const [recs, setRecs] = useState<Recommendation[]>([]);
    const [dailyPick, setDailyPick] = useState<DailyPick | null>(null);
    const [missions, setMissions] = useState<BacklogMission[]>([]);
    const [collections, setCollections] = useState<SmartCollection[]>([]);
    const [tasteProfile, setTasteProfile] = useState<TasteProfile | null>(null);
    const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null);
    const [versus, setVersus] = useState<VersusPair | null>(null);
    const [loading, setLoading] = useState(true);
    const [versusSelected, setVersusSelected] = useState<number | null>(null);
    const [versusMsg, setVersusMsg] = useState('');
    const versusShownIds = React.useRef<number[]>([]);
    const [profileInitialized, setProfileInitialized] = useState(false);

    useFocusEffect(
        React.useCallback(() => {
            loadData();
        }, [])
    );

    const loadData = () => {
        setLoading(true);
        setVersusSelected(null);
        setVersusMsg('');
        versusShownIds.current = [];
        setProfileInitialized(isAiProfileInitialized());
        setRecs(
            getRecommendations({
                mode: focusMode ? 'focus' : 'balanced',
                availableTimeHours: sessionHours,
                mood,
                goal,
                limit: 6,
            })
        );
        setDailyPick(getDailyPick());
        setMissions(getBacklogMissions());
        setCollections(getSmartCollections());
        setTasteProfile(getTasteProfile());
        setWeeklyPlan(getWeeklyPlan(sessionHours ? sessionHours * 4 : 7));
        const firstPair = getVersusPair([]);
        if (firstPair) {
            versusShownIds.current = [firstPair.left.game.id, firstPair.right.game.id];
        }
        setVersus(firstPair);
        trackEvent('ai_pick_used');
        setLoading(false);
    };

    const pickVersus = (rec: Recommendation) => {
        recordVersusChoice(rec);
        setVersusSelected(rec.game.id);
        setVersusMsg(t('ai_versus_learned', language as Language));
        setTimeout(() => {
            setVersusSelected(null);
            setVersusMsg('');
            const nextPair = getVersusPair(versusShownIds.current);
            if (nextPair) {
                versusShownIds.current = [...versusShownIds.current, nextPair.left.game.id, nextPair.right.game.id];
            }
            setVersus(nextPair);
        }, 1200);
    };

    return (
        <View style={[styles.root, { backgroundColor: themeColors.bg }]}>
            <LinearGradient colors={[themeColors.bg, themeColors.card]} style={StyleSheet.absoluteFill} />

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={[styles.title, { color: themeColors.textPrimary }]}>{t('ai_title', language as Language)}</Text>
                    <Text style={[styles.subtitle, { color: themeColors.textMuted }]}>
                        {t('ai_subtitle_premium', language as Language)}
                    </Text>
                </View>

                {/* Intent filters (always visible) */}
                <View style={styles.section}>
                    <GlassCard padding={20} style={styles.focusSwitchCard}>
                        <View style={styles.focusTextWrap}>
                            <Text style={[styles.focusTitle, { color: themeColors.textPrimary }]}>{t('ai_focus_mode', language as Language)}</Text>
                            <Text style={[styles.focusSubtitle, { color: themeColors.textMuted }]}>
                                {t('ai_focus_desc', language as Language)}
                            </Text>
                        </View>
                        <Switch
                            value={focusMode}
                            onValueChange={setFocusMode}
                            trackColor={{ false: themeColors.glassBorder, true: themeColors.accent }}
                            thumbColor={themeColors.textPrimary}
                        />
                    </GlassCard>
                </View>

                <View style={styles.section}>
                    <GlassCard padding={20}>
                        <Text style={[styles.filterLabel, { color: themeColors.textMuted }]}>{t('ai_mood', language as Language)}</Text>
                        <View style={styles.sessionChips}>
                            {MOOD_OPTIONS.map((option) => {
                                const active = mood === option.value;
                                return (
                                    <TouchableOpacity
                                        key={option.value}
                                        style={[
                                            styles.sessionChip,
                                            {
                                                backgroundColor: active ? themeColors.accent : themeColors.card,
                                                borderColor: active ? themeColors.accent : themeColors.glassBorder,
                                            },
                                        ]}
                                        onPress={() => setMood(option.value)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={[styles.sessionChipText, { color: active ? '#fff' : themeColors.textPrimary }]}>
                                            {option.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </GlassCard>
                </View>

                <View style={styles.section}>
                    <GlassCard padding={20}>
                        <Text style={[styles.filterLabel, { color: themeColors.textMuted }]}>{t('ai_session', language as Language)}</Text>
                        <View style={styles.sessionChips}>
                            {SESSION_OPTIONS.map((option) => {
                                const active = sessionHours === option.value;
                                return (
                                    <TouchableOpacity
                                        key={option.label}
                                        style={[
                                            styles.sessionChip,
                                            {
                                                backgroundColor: active ? themeColors.violet : themeColors.card,
                                                borderColor: active ? themeColors.violet : themeColors.glassBorder,
                                            },
                                        ]}
                                        onPress={() => setSessionHours(option.value)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={[styles.sessionChipText, { color: active ? '#fff' : themeColors.textPrimary }]}>
                                            {option.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </GlassCard>
                </View>

                <View style={styles.section}>
                    <GlassCard padding={20}>
                        <Text style={[styles.filterLabel, { color: themeColors.textMuted }]}>{t('ai_goal', language as Language)}</Text>
                        <View style={styles.sessionChips}>
                            {GOAL_OPTIONS.map((option) => {
                                const active = goal === option.value;
                                return (
                                    <TouchableOpacity
                                        key={option.value}
                                        style={[
                                            styles.sessionChip,
                                            {
                                                backgroundColor: active ? themeColors.teal : themeColors.card,
                                                borderColor: active ? themeColors.teal : themeColors.glassBorder,
                                            },
                                        ]}
                                        onPress={() => setGoal(option.value)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={[styles.sessionChipText, { color: active ? '#fff' : themeColors.textPrimary }]}>
                                            {option.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </GlassCard>
                </View>

                <TouchableOpacity
                    style={[styles.applyBtn, { backgroundColor: themeColors.accent }]}
                    onPress={loadData}
                    activeOpacity={0.85}
                >
                    <Ionicons name="sparkles" size={16} color="#fff" />
                    <Text style={styles.applyBtnText}>{t('ai_get_picks', language as Language)}</Text>
                </TouchableOpacity>

                {/* Daily Pick */}
                {dailyPick && (
                    <View style={styles.section}>
                        <SectionHeader title={t('ai_daily_pick', language as Language)} icon="flash" iconColor={themeColors.teal} />
                        <TouchableOpacity onPress={() => router.push(`/game/${dailyPick.recommendation.game.id}`)} activeOpacity={0.82}>
                            <GlassCard padding={18} radius={20} borderColor={themeColors.teal} style={{ overflow: 'hidden' }}>
                                <LinearGradient
                                    colors={[themeColors.teal + '22', themeColors.blue + '10']}
                                    style={StyleSheet.absoluteFill}
                                />
                                <View style={styles.dailyHeader}>
                                    <View style={[styles.dailyIcon, { backgroundColor: themeColors.teal + '22' }]}>
                                        <Ionicons name="flash" size={20} color={themeColors.teal} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.dailyTitle, { color: themeColors.textPrimary }]}>
                                            {dailyPick.recommendation.game.title}
                                        </Text>
                                        <Text style={[styles.dailySubtitle, { color: themeColors.textSecondary }]}>
                                            {dailyPick.recommendation.reason}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.badgeRow}>
                                    {dailyPick.recommendation.badges.map((badge) => (
                                        <View key={badge} style={[styles.smallBadge, { borderColor: themeColors.teal + '55', backgroundColor: themeColors.teal + '14' }]}>
                                            <Text style={[styles.smallBadgeText, { color: themeColors.teal }]}>{badge}</Text>
                                        </View>
                                    ))}
                                </View>
                                <Text style={[styles.dailyStreak, { color: themeColors.teal }]}>{dailyPick.subtitle}</Text>
                            </GlassCard>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Top Picks */}
                <View style={styles.section}>
                    <SectionHeader title={t('ai_top_picks', language as Language)} icon="sparkles" iconColor={themeColors.orange} />

                    {loading ? (
                        <ActivityIndicator size="large" color={themeColors.orange} style={{ marginTop: 40 }} />
                    ) : recs.length === 0 ? (
                        <GlassCard padding={20}>
                            <Text style={{ color: themeColors.textMuted, textAlign: 'center' }}>
                                {t('ai_no_games', language as Language)}
                            </Text>
                        </GlassCard>
                    ) : (
                        recs.map((rec) => (
                            <View key={rec.game.id} style={styles.recWrapper}>
                                <View style={[styles.reasonCard, { backgroundColor: themeColors.card, borderColor: themeColors.glassBorder }]}>
                                    <Ionicons name="sparkles" size={14} color={themeColors.violet} />
                                    <View style={styles.reasonContent}>
                                        <View style={styles.badgeRow}>
                                            {rec.badges.map((badge) => {
                                                const isLowConf = badge === 'Low confidence';
                                                return (
                                                    <View
                                                        key={badge}
                                                        style={[
                                                            styles.smallBadge,
                                                            isLowConf
                                                                ? { borderColor: themeColors.orange + '55', backgroundColor: themeColors.orange + '12' }
                                                                : { borderColor: themeColors.accent + '55', backgroundColor: themeColors.accent + '12' },
                                                        ]}
                                                    >
                                                        <Text style={[styles.smallBadgeText, { color: isLowConf ? themeColors.orange : themeColors.accent }]}>
                                                            {badge}
                                                        </Text>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                        <Text style={[styles.reasonText, { color: themeColors.textPrimary }]}>
                                            {rec.reason}
                                        </Text>
                                        {rec.whyNot ? (
                                            <Text style={[styles.whyNotText, { color: themeColors.textMuted }]}>
                                                {t('ai_why_not', language as Language)} {rec.whyNot}
                                            </Text>
                                        ) : null}
                                    </View>
                                </View>
                                <GameCard game={rec.game} />
                            </View>
                        ))
                    )}
                </View>

                {/* Taste Profile */}
                {tasteProfile && profileInitialized && (
                    <View style={styles.section}>
                        <SectionHeader title={t('ai_taste_profile', language as Language)} icon="person" iconColor={themeColors.orange} />
                        <GlassCard padding={18}>
                            <Text style={[styles.profileTitle, { color: themeColors.textPrimary }]}>{tasteProfile.title}</Text>
                            <Text style={[styles.profileSummary, { color: themeColors.textSecondary }]}>{tasteProfile.summary}</Text>
                            <View style={styles.badgeRow}>
                                {tasteProfile.tags.map((tag) => (
                                    <View key={tag} style={[styles.smallBadge, { borderColor: themeColors.glassBorder, backgroundColor: themeColors.card }]}>
                                        <Text style={[styles.smallBadgeText, { color: themeColors.textPrimary }]}>{tag}</Text>
                                    </View>
                                ))}
                            </View>
                        </GlassCard>
                    </View>
                )}

                {tasteProfile && !profileInitialized && (
                    <View style={styles.section}>
                        <SectionHeader title={t('ai_taste_profile', language as Language)} icon="person" iconColor={themeColors.orange} />
                        <GlassCard padding={18}>
                            <View style={styles.buildProfileRow}>
                                <Ionicons name="bar-chart-outline" size={20} color={themeColors.orange} />
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.profileTitle, { color: themeColors.textPrimary }]}>{t('ai_build_profile', language as Language)}</Text>
                                    <Text style={[styles.profileSummary, { color: themeColors.textSecondary }]}>
                                        {t('ai_build_profile_desc', language as Language)}
                                    </Text>
                                </View>
                            </View>
                        </GlassCard>
                    </View>
                )}

                {/* Versus Picker */}
                {versus && (
                    <View style={styles.section}>
                        <SectionHeader title={t('ai_versus', language as Language)} icon="git-compare" iconColor={themeColors.accent} />
                        <GlassCard padding={18}>
                            <Text style={[styles.versusPrompt, { color: themeColors.textPrimary }]}>{t('ai_versus_prompt', language as Language)}</Text>
                            {versusMsg ? (
                                <View style={[styles.versusMsg, { backgroundColor: themeColors.accent + '22' }]}>
                                    <Ionicons name="checkmark-circle" size={16} color={themeColors.accent} />
                                    <Text style={[styles.versusMsgText, { color: themeColors.accent }]}>{versusMsg}</Text>
                                </View>
                            ) : null}
                            <View style={styles.versusRow}>
                                {[versus.left, versus.right].map((rec) => {
                                    const isSelected = versusSelected === rec.game.id;
                                    return (
                                        <TouchableOpacity
                                            key={rec.game.id}
                                            style={[
                                                styles.versusCard,
                                                {
                                                    borderColor: isSelected ? themeColors.accent : themeColors.glassBorder,
                                                    backgroundColor: isSelected ? themeColors.accent + '18' : themeColors.card,
                                                },
                                            ]}
                                            onPress={() => pickVersus(rec)}
                                            activeOpacity={0.82}
                                            disabled={versusSelected !== null}
                                        >
                                            <Text style={[styles.versusTitle, { color: themeColors.textPrimary }]} numberOfLines={2}>
                                                {rec.game.title}
                                            </Text>
                                            <Text style={[styles.versusReason, { color: themeColors.textSecondary }]} numberOfLines={3}>
                                                {rec.reason}
                                            </Text>
                                            <View style={[styles.pickButton, { backgroundColor: isSelected ? themeColors.accent : themeColors.accent + '22' }]}>
                                                <Text style={[styles.pickButtonText, { color: isSelected ? '#fff' : themeColors.accent }]}>
                                                    {isSelected ? t('ai_versus_picked', language as Language) : t('ai_versus_pick', language as Language)}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </GlassCard>
                    </View>
                )}

                {/* Smart Collections */}
                {collections.length > 0 && (
                    <View style={styles.section}>
                        <SectionHeader title={t('ai_smart_collections', language as Language)} icon="albums" iconColor={themeColors.blue} />
                        {collections.map((collection) => (
                            <GlassCard key={collection.id} padding={18} style={styles.collectionCard}>
                                <Text style={[styles.collectionTitle, { color: themeColors.textPrimary }]}>{collection.title}</Text>
                                <Text style={[styles.collectionDesc, { color: themeColors.textSecondary }]}>{collection.description}</Text>
                                {collection.games.map((gameRec) => (
                                    <TouchableOpacity key={gameRec.game.id} onPress={() => router.push(`/game/${gameRec.game.id}`)} activeOpacity={0.82}>
                                        <View style={[styles.collectionItem, { borderTopColor: themeColors.glassBorder }]}>
                                            <Text style={[styles.collectionGame, { color: themeColors.textPrimary }]} numberOfLines={1}>
                                                {gameRec.game.title}
                                            </Text>
                                            <Text style={[styles.collectionMeta, { color: themeColors.textMuted }]}>{gameRec.reason}</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </GlassCard>
                        ))}
                    </View>
                )}

                {/* Weekly Plan */}
                {weeklyPlan && weeklyPlan.items.length > 0 && (
                    <View style={styles.section}>
                        <SectionHeader title={t('ai_weekly_plan', language as Language)} icon="calendar" iconColor={themeColors.violet} />
                        <GlassCard padding={18}>
                            <Text style={[styles.planSummary, { color: themeColors.textSecondary }]}>{weeklyPlan.summary}</Text>
                            {weeklyPlan.items.map((item) => (
                                <TouchableOpacity key={item.label + item.recommendation.game.id} onPress={() => router.push(`/game/${item.recommendation.game.id}`)} activeOpacity={0.82}>
                                    <View style={[styles.planRow, { borderTopColor: themeColors.glassBorder }]}>
                                        <Text style={[styles.planLabel, { color: themeColors.violet }]}>{item.label}</Text>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.planTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
                                                {item.recommendation.game.title}
                                            </Text>
                                            <Text style={[styles.planNote, { color: themeColors.textMuted }]}>{item.note}</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </GlassCard>
                    </View>
                )}

                {/* Backlog Missions */}
                {missions.length > 0 && (
                    <View style={styles.section}>
                        <SectionHeader title={t('ai_missions', language as Language)} icon="flag" iconColor={themeColors.green} />
                        {missions.map((mission) => (
                            <TouchableOpacity
                                key={mission.id}
                                activeOpacity={mission.gameId ? 0.82 : 1}
                                onPress={() => mission.gameId ? router.push(`/game/${mission.gameId}`) : undefined}
                            >
                                <GlassCard padding={16} style={styles.missionCard}>
                                    <Text style={[styles.missionTitle, { color: themeColors.textPrimary }]}>{mission.title}</Text>
                                    <Text style={[styles.missionDesc, { color: themeColors.textSecondary }]}>{mission.description}</Text>
                                </GlassCard>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                <View style={{ height: 120 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    scroll: { paddingTop: 60, paddingHorizontal: 20 },
    header: { marginBottom: 24 },
    title: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
    subtitle: { fontSize: 14, marginTop: 4, lineHeight: 20 },
    section: { marginBottom: 24 },
    dailyHeader: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    dailyIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    dailyTitle: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
    dailySubtitle: { fontSize: 13, lineHeight: 18 },
    dailyStreak: { fontSize: 12, fontWeight: '800', marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
    profileTitle: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
    profileSummary: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
    buildProfileRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    focusSwitchCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    focusTextWrap: { flex: 1 },
    focusTitle: { fontSize: 16, fontWeight: '700' },
    focusSubtitle: { fontSize: 12, marginTop: 2 },
    filterLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
    sessionChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    sessionChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
    sessionChipText: { fontSize: 13, fontWeight: '700' },
    badgeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 10 },
    smallBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
    smallBadgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
    missionCard: { marginBottom: 10 },
    missionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 5 },
    missionDesc: { fontSize: 13, lineHeight: 19 },
    versusPrompt: { fontSize: 16, fontWeight: '800', marginBottom: 14 },
    versusMsg: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, padding: 10, marginBottom: 12 },
    versusMsgText: { fontSize: 13, fontWeight: '700' },
    versusRow: { flexDirection: 'row', gap: 12 },
    versusCard: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 14 },
    versusTitle: { fontSize: 15, fontWeight: '800', marginBottom: 8 },
    versusReason: { fontSize: 12, lineHeight: 18, marginBottom: 14 },
    pickButton: { height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    pickButtonText: { fontSize: 12, fontWeight: '800' },
    collectionCard: { marginBottom: 12 },
    collectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
    collectionDesc: { fontSize: 12, lineHeight: 18, marginBottom: 8 },
    collectionItem: { paddingTop: 10, marginTop: 10, borderTopWidth: 1 },
    collectionGame: { fontSize: 14, fontWeight: '700', marginBottom: 3 },
    collectionMeta: { fontSize: 12, lineHeight: 17 },
    planSummary: { fontSize: 13, lineHeight: 18, marginBottom: 8 },
    planRow: { flexDirection: 'row', gap: 12, paddingTop: 12, marginTop: 12, borderTopWidth: 1 },
    planLabel: { width: 34, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
    planTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
    planNote: { fontSize: 12, lineHeight: 17 },
    applyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 14, marginBottom: 24 },
    applyBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
    recWrapper: { marginBottom: 20 },
    reasonCard: {
        alignSelf: 'stretch',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 16,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        marginBottom: -12,
        marginHorizontal: 12,
        zIndex: 10,
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    reasonContent: { flex: 1, gap: 8 },
    reasonText: { fontSize: 12, fontWeight: '600', lineHeight: 18, flex: 1 },
    whyNotText: { fontSize: 11, lineHeight: 16 },
    paywallHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    paywallTitle: { fontSize: 18, fontWeight: '800', flex: 1 },
    paywallSubtitle: { fontSize: 13, marginBottom: 14 },
    benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    benefitText: { fontSize: 13, flex: 1 },
    paywallBtn: { marginTop: 16, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    paywallBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
    paywallOverlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'center', alignItems: 'center', padding: 24 },
    paywallModal: { width: '100%', borderRadius: 24, borderWidth: 1, padding: 24, overflow: 'hidden' },
});
