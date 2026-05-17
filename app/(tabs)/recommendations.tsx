import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAppContext } from '../../src/hooks/useAppContext';
import { t } from '../../src/i18n';
import { ED, edStyles, MONO_FONT, coverPaletteFor } from '../../src/styles/editorial';
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

function CoverPlaceholder({ title, width, height, radius = 10, seed = 0 }: {
    title: string; width: number; height: number; radius?: number; seed?: number;
}) {
    const pal = coverPaletteFor(title, seed);
    return (
        <View style={{
            width, height, borderRadius: radius,
            backgroundColor: pal.b,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
        }}>
            <View style={{
                position: 'absolute', bottom: -10, right: -10,
                width: width * 0.8, height: width * 0.8,
                borderRadius: width * 0.4,
                backgroundColor: pal.a,
                opacity: 0.5,
            }} />
            <Text style={{
                fontFamily: MONO_FONT, fontSize: 9, fontWeight: '600',
                color: ED.ink3, textAlign: 'center', paddingHorizontal: 4,
                letterSpacing: 0.5, textTransform: 'uppercase',
            }} numberOfLines={2}>{title}</Text>
        </View>
    );
}

export default function PickScreen() {
    const router = useRouter();
    const { language = 'en' } = useAppContext() as any;
    const MOOD_OPTIONS = getMoodOptions(language as Language);
    const SESSION_OPTIONS = getSessionOptions(language as Language);
    const GOAL_OPTIONS = getGoalOptions(language as Language);

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
    const [versusSelected, setVersusSelected] = useState<number | null>(null);
    const [versusMsg, setVersusMsg] = useState('');
    const versusShownIds = React.useRef<number[]>([]);
    const [profileInitialized, setProfileInitialized] = useState(false);

    useFocusEffect(
        React.useCallback(() => {
            loadData();
        }, [mood, sessionHours, goal])
    );

    const loadData = () => {
        setVersusSelected(null);
        setVersusMsg('');
        versusShownIds.current = [];
        setProfileInitialized(isAiProfileInitialized());
        setRecs(getRecommendations({
            mode: 'balanced',
            availableTimeHours: sessionHours,
            mood,
            goal,
            limit: 6,
        }));
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

    const topRec = recs[0] ?? null;
    const restRecs = recs.slice(1);

    const now = new Date();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const timeStr = `${dayNames[now.getDay()]} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

    return (
        <View style={s.root}>
            <ScrollView
                contentContainerStyle={s.scroll}
                showsVerticalScrollIndicator={false}
            >
                {/* ── Header ── */}
                <View style={s.header}>
                    <Text style={[edStyles.eyebrow, { color: ED.copper, marginBottom: 6 }]}>
                        ◆ AI · {timeStr}
                    </Text>
                    <Text style={[edStyles.displayTitle, { fontSize: 38 }]}>Pick.</Text>
                    <Text style={s.headerSub}>
                        What kind of evening are you having?{'\n'}I'll find something from your library.
                    </Text>
                </View>

                {/* ── Mood chips ── */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.moodScroll}
                    style={{ marginHorizontal: -24 }}
                >
                    {MOOD_OPTIONS.map((opt) => {
                        const active = mood === opt.value;
                        return (
                            <TouchableOpacity
                                key={opt.value}
                                style={[s.chip, active && s.chipActive]}
                                onPress={() => setMood(opt.value)}
                                activeOpacity={0.75}
                            >
                                <Text style={[s.chipText, active && s.chipTextActive]}>
                                    {opt.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {/* ── Session + Goal row ── */}
                <View style={s.filterRow}>
                    {/* Session */}
                    <View style={[edStyles.card, s.filterCard]}>
                        <Text style={[edStyles.eyebrow, { marginBottom: 8 }]}>Session</Text>
                        <View style={s.sessionBtns}>
                            {SESSION_OPTIONS.map((opt) => {
                                const active = sessionHours === opt.value;
                                return (
                                    <TouchableOpacity
                                        key={opt.label}
                                        style={[s.sessionBtn, active && s.sessionBtnActive]}
                                        onPress={() => setSessionHours(opt.value)}
                                        activeOpacity={0.75}
                                    >
                                        <Text style={[s.sessionBtnText, active && s.sessionBtnTextActive]}>
                                            {opt.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* Goal */}
                    <View style={[edStyles.card, s.filterCard]}>
                        <Text style={[edStyles.eyebrow, { marginBottom: 8 }]}>Goal</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
                            <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 4 }}>
                                {GOAL_OPTIONS.map((opt) => {
                                    const active = goal === opt.value;
                                    return (
                                        <TouchableOpacity
                                            key={opt.value}
                                            style={[s.goalBtn, active && s.goalBtnActive]}
                                            onPress={() => setGoal(opt.value)}
                                            activeOpacity={0.75}
                                        >
                                            <Text style={[s.goalBtnText, active && s.goalBtnTextActive]}>
                                                {opt.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </ScrollView>
                    </View>
                </View>

                {/* ── Refresh button ── */}
                <TouchableOpacity style={s.refreshBtn} onPress={loadData} activeOpacity={0.8}>
                    <Ionicons name="sparkles-outline" size={14} color={ED.copper} />
                    <Text style={s.refreshBtnText}>Refresh picks</Text>
                </TouchableOpacity>

                {/* ── Top match hero ── */}
                {topRec && (
                    <View style={s.section}>
                        <View style={edStyles.sectionHead}>
                            <Text style={edStyles.eyebrow}>Top match</Text>
                            <Text style={[edStyles.eyebrow, { color: ED.copper }]}>
                                CONFIDENCE · {topRec.score >= 80 ? 'HIGH' : topRec.score >= 60 ? 'MED' : 'LOW'}
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={edStyles.card}
                            onPress={() => router.push(`/game/${topRec.game.id}` as any)}
                            activeOpacity={0.85}
                        >
                            <View style={{ flexDirection: 'row' }}>
                                <CoverPlaceholder
                                    title={topRec.game.title}
                                    width={120}
                                    height={170}
                                    radius={0}
                                    seed={1}
                                />
                                <View style={s.heroContent}>
                                    <View style={s.heroTop}>
                                        <View style={s.matchPill}>
                                            <Text style={s.matchPillText}>{topRec.score}% MATCH</Text>
                                        </View>
                                    </View>
                                    <Text style={s.heroTitle} numberOfLines={2}>{topRec.game.title}</Text>
                                    {topRec.game.hltb_main_story ? (
                                        <Text style={[edStyles.eyebrow, { color: ED.copper, marginTop: 4 }]}>
                                            {Math.round(topRec.game.hltb_main_story / 3600)}h main
                                        </Text>
                                    ) : null}
                                    <Text style={s.heroReason} numberOfLines={3}>{topRec.reason}</Text>
                                </View>
                            </View>

                            {/* Badge row */}
                            {topRec.badges.length > 0 && (
                                <View style={s.heroBadges}>
                                    {topRec.badges.slice(0, 4).map((badge) => (
                                        <View key={badge} style={edStyles.chip}>
                                            <Text style={edStyles.chipText}>{badge}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* Actions */}
                            <View style={s.heroActions}>
                                <TouchableOpacity
                                    style={[edStyles.btn, edStyles.btnPrimary, { flex: 1, height: 38 }]}
                                    onPress={() => router.push(`/game/${topRec.game.id}` as any)}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="play" size={13} color="#1A1108" />
                                    <Text style={[edStyles.btnText, edStyles.btnPrimaryText, { fontSize: 13 }]}>Set as next</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[edStyles.btn, { width: 38, height: 38, paddingHorizontal: 0 }]} onPress={loadData} activeOpacity={0.8}>
                                    <Ionicons name="refresh-outline" size={14} color={ED.ink2} />
                                </TouchableOpacity>
                            </View>
                        </TouchableOpacity>
                    </View>
                )}

                {/* ── Other recommendations ── */}
                {restRecs.length > 0 && (
                    <View style={s.section}>
                        <View style={edStyles.sectionHead}>
                            <Text style={edStyles.eyebrow}>More picks</Text>
                            <Text style={[edStyles.eyebrow, { color: ED.ink3 }]}>{restRecs.length} games</Text>
                        </View>
                        <View style={edStyles.card}>
                            {restRecs.map((rec, idx) => (
                                <TouchableOpacity
                                    key={rec.game.id}
                                    style={[s.recRow, idx < restRecs.length - 1 && { borderBottomWidth: 1, borderBottomColor: ED.line }]}
                                    onPress={() => router.push(`/game/${rec.game.id}` as any)}
                                    activeOpacity={0.8}
                                >
                                    <CoverPlaceholder title={rec.game.title} width={44} height={62} seed={idx + 2} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.recTitle} numberOfLines={1}>{rec.game.title}</Text>
                                        <Text style={s.recReason} numberOfLines={2}>{rec.reason}</Text>
                                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                                            {rec.badges.slice(0, 2).map((b) => (
                                                <View key={b} style={edStyles.pill}>
                                                    <Text style={edStyles.pillText}>{b}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                    <Text style={s.recScore}>{rec.score}%</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {/* ── Versus ── */}
                {versus && (
                    <View style={s.section}>
                        <View style={edStyles.sectionHead}>
                            <Text style={edStyles.eyebrow}>Help me decide</Text>
                            <Text style={[edStyles.eyebrow, { color: ED.ink3 }]}>VERSUS</Text>
                        </View>
                        <Text style={s.versusSub}>Tonight, which feels right?</Text>

                        {versusMsg ? (
                            <View style={s.versusMsg}>
                                <Ionicons name="checkmark-circle" size={14} color={ED.moss} />
                                <Text style={s.versusMsgText}>{versusMsg}</Text>
                            </View>
                        ) : null}

                        <View style={s.versusRow}>
                            <View style={{ width: 28, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={s.vsLabel}>vs</Text>
                            </View>
                            {[versus.left, versus.right].map((rec, idx) => {
                                const picked = versusSelected === rec.game.id;
                                return (
                                    <TouchableOpacity
                                        key={rec.game.id}
                                        style={[
                                            edStyles.card,
                                            s.versusCard,
                                            picked && { borderColor: ED.copper },
                                        ]}
                                        onPress={() => pickVersus(rec)}
                                        activeOpacity={0.8}
                                        disabled={versusSelected !== null}
                                    >
                                        <View style={[s.versusCover, { backgroundColor: coverPaletteFor(rec.game.title, idx + 8).b }]}>
                                            <View style={[s.versusCoverGlow, { backgroundColor: coverPaletteFor(rec.game.title, idx + 8).a }]} />
                                            <Text style={s.versusCoverLabel} numberOfLines={2}>{rec.game.title}</Text>
                                        </View>
                                        <Text style={s.versusTitle} numberOfLines={2}>{rec.game.title}</Text>
                                        {rec.game.hltb_main_story ? (
                                            <Text style={s.versusMeta}>
                                                {Math.round(rec.game.hltb_main_story / 3600)}h
                                            </Text>
                                        ) : null}
                                        <View style={[s.versusPickBtn, picked && s.versusPickBtnActive]}>
                                            <Text style={[s.versusPickText, picked && s.versusPickTextActive]}>
                                                {picked ? 'Picked ✓' : 'This one'}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* ── Smart collections ── */}
                {collections.length > 0 && (
                    <View style={s.section}>
                        <View style={edStyles.sectionHead}>
                            <Text style={edStyles.eyebrow}>Collections</Text>
                            <Text style={[edStyles.eyebrow, { color: ED.ink3 }]}>CURATED FOR YOU</Text>
                        </View>
                        <View style={{ gap: 10 }}>
                            {collections.map((col, ci) => (
                                <View key={col.id} style={edStyles.card}>
                                    <View style={s.colHeader}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={s.colTitle}>{col.title}</Text>
                                            <Text style={s.colSub}>{col.description}</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={14} color={ED.ink3} />
                                    </View>
                                    <View style={s.colCovers}>
                                        {col.games.slice(0, 4).map((gr, gi) => (
                                            <CoverPlaceholder
                                                key={gr.game.id}
                                                title={gr.game.title}
                                                width={58}
                                                height={82}
                                                seed={ci * 5 + gi}
                                            />
                                        ))}
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* ── Daily Pick ── */}
                {dailyPick && (
                    <View style={s.section}>
                        <View style={edStyles.sectionHead}>
                            <Text style={edStyles.eyebrow}>Daily pick</Text>
                            <Ionicons name="flash" size={12} color={ED.amber} />
                        </View>
                        <TouchableOpacity
                            style={edStyles.card}
                            onPress={() => router.push(`/game/${dailyPick.recommendation.game.id}` as any)}
                            activeOpacity={0.85}
                        >
                            <View style={s.dailyInner}>
                                <CoverPlaceholder
                                    title={dailyPick.recommendation.game.title}
                                    width={56}
                                    height={78}
                                    seed={0}
                                />
                                <View style={{ flex: 1 }}>
                                    <Text style={s.dailyTitle} numberOfLines={1}>{dailyPick.recommendation.game.title}</Text>
                                    <Text style={s.dailyReason} numberOfLines={2}>{dailyPick.recommendation.reason}</Text>
                                    <Text style={s.dailyStreak}>{dailyPick.subtitle}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={14} color={ED.ink3} />
                            </View>
                        </TouchableOpacity>
                    </View>
                )}

                {/* ── Weekly plan ── */}
                {weeklyPlan && weeklyPlan.items.length > 0 && (
                    <View style={s.section}>
                        <View style={edStyles.sectionHead}>
                            <Text style={edStyles.eyebrow}>This week's plan</Text>
                            <Text style={[edStyles.eyebrow, { color: ED.copper, fontFamily: MONO_FONT }]}>
                                {weeklyPlan.items.length * (sessionHours ?? 2)}H ALLOCATED
                            </Text>
                        </View>
                        <View style={edStyles.card}>
                            {weeklyPlan.items.map((item, idx) => (
                                <TouchableOpacity
                                    key={item.label + item.recommendation.game.id}
                                    style={[s.planRow, idx < weeklyPlan.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: ED.line }]}
                                    onPress={() => router.push(`/game/${item.recommendation.game.id}` as any)}
                                    activeOpacity={0.8}
                                >
                                    <View style={s.planDay}>
                                        <Text style={s.planDayLabel}>{item.label}</Text>
                                        <Text style={s.planDaySub}>{item.note}</Text>
                                    </View>
                                    <CoverPlaceholder title={item.recommendation.game.title} width={40} height={56} seed={idx} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.planTitle} numberOfLines={1}>{item.recommendation.game.title}</Text>
                                        <Text style={s.planNote} numberOfLines={1}>{item.note}</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={12} color={ED.ink4} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {/* ── Missions ── */}
                {missions.length > 0 && (
                    <View style={s.section}>
                        <View style={edStyles.sectionHead}>
                            <Text style={edStyles.eyebrow}>Missions</Text>
                            <Text style={[edStyles.eyebrow, { color: ED.ink3 }]}>
                                {missions.length} active
                            </Text>
                        </View>
                        <View style={edStyles.card}>
                            {missions.map((mission, idx) => (
                                <TouchableOpacity
                                    key={mission.id}
                                    style={[s.missionRow, idx < missions.length - 1 && { borderBottomWidth: 1, borderBottomColor: ED.line }]}
                                    onPress={() => mission.gameId ? router.push(`/game/${mission.gameId}` as any) : undefined}
                                    activeOpacity={mission.gameId ? 0.8 : 1}
                                >
                                    <View style={s.missionIcon}>
                                        <Ionicons
                                            name="flag-outline"
                                            size={14}
                                            color={ED.copper}
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.missionTitle} numberOfLines={1}>
                                            {mission.title}
                                        </Text>
                                        <Text style={s.missionDesc} numberOfLines={1}>{mission.description}</Text>
                                    </View>
                                    {mission.gameId && <Ionicons name="chevron-forward" size={12} color={ED.ink4} />}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {/* ── Taste profile ── */}
                {tasteProfile && (
                    <View style={s.section}>
                        <View style={edStyles.sectionHead}>
                            <Text style={edStyles.eyebrow}>Your taste</Text>
                            {profileInitialized && (
                                <Text style={[edStyles.eyebrow, { color: ED.ink3 }]}>CALIBRATED</Text>
                            )}
                        </View>
                        <View style={edStyles.card}>
                            <View style={{ padding: 20 }}>
                                {profileInitialized ? (
                                    <>
                                        <Text style={s.tasteTitle}>"{tasteProfile.title}"</Text>
                                        <Text style={s.tasteSummary}>{tasteProfile.summary}</Text>
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
                                            {tasteProfile.tags.map((tag) => (
                                                <View key={tag} style={edStyles.chip}>
                                                    <Text style={edStyles.chipText}>{tag}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </>
                                ) : (
                                    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                                        <Ionicons name="bar-chart-outline" size={20} color={ED.copper} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={s.tasteTitle}>{t('ai_build_profile', language as Language)}</Text>
                                            <Text style={s.tasteSummary}>{t('ai_build_profile_desc', language as Language)}</Text>
                                        </View>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>
                )}

                <View style={{ height: 120 }} />
            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: ED.bg },
    scroll: { paddingTop: Platform.OS === 'ios' ? 60 : 48, paddingHorizontal: 24 },
    header: { marginBottom: 20 },
    headerSub: { fontSize: 13, color: ED.ink3, marginTop: 8, lineHeight: 20 },

    moodScroll: { flexDirection: 'row', gap: 6, paddingHorizontal: 24, paddingBottom: 20 },
    chip: {
        flexDirection: 'row' as const, alignItems: 'center' as const,
        height: 32, paddingHorizontal: 14, gap: 4,
        borderRadius: 100, backgroundColor: ED.surface2,
        borderWidth: 1, borderColor: ED.line,
    },
    chipActive: { backgroundColor: ED.copperBg, borderColor: ED.copperLine },
    chipText: { fontSize: 12.5, fontWeight: '500' as const, color: ED.ink2, letterSpacing: -0.1 },
    chipTextActive: { color: ED.copper },

    filterRow: { gap: 10, marginBottom: 16 },
    filterCard: { padding: 14 },
    sessionBtns: { flexDirection: 'row', gap: 4 },
    sessionBtn: {
        flex: 1, height: 30, borderRadius: 8,
        borderWidth: 1, borderColor: ED.line,
        alignItems: 'center', justifyContent: 'center',
    },
    sessionBtnActive: { backgroundColor: ED.ink, borderColor: ED.ink },
    sessionBtnText: { fontFamily: MONO_FONT, fontSize: 11, fontWeight: '600', color: ED.ink2 },
    sessionBtnTextActive: { color: ED.bg },
    goalBtn: {
        height: 28, paddingHorizontal: 10, borderRadius: 8,
        borderWidth: 1, borderColor: ED.line,
        alignItems: 'center', justifyContent: 'center',
    },
    goalBtnActive: { backgroundColor: ED.copperBg, borderColor: ED.copperLine },
    goalBtnText: { fontSize: 12, fontWeight: '500', color: ED.ink2 },
    goalBtnTextActive: { color: ED.copper },

    refreshBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, height: 38, borderRadius: 10,
        borderWidth: 1, borderColor: ED.copperLine,
        backgroundColor: ED.copperBg, marginBottom: 28,
    },
    refreshBtnText: { fontSize: 13, fontWeight: '600', color: ED.copper },

    section: { marginBottom: 28 },

    heroContent: { flex: 1, padding: 14, justifyContent: 'space-between' },
    heroTop: { flexDirection: 'row', justifyContent: 'flex-end' },
    matchPill: {
        backgroundColor: ED.copper, borderRadius: 4,
        paddingHorizontal: 7, paddingVertical: 3,
    },
    matchPillText: { fontFamily: MONO_FONT, fontSize: 9, fontWeight: '700', color: '#1A1108' },
    heroTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.6, color: ED.ink, marginTop: 6 },
    heroReason: { fontSize: 12, color: ED.ink2, lineHeight: 18, marginTop: 6 },
    heroBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 12, borderTopWidth: 1, borderTopColor: ED.line },
    heroActions: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: ED.line },

    recRow: { flexDirection: 'row', gap: 12, padding: 14, alignItems: 'center' },
    recTitle: { fontSize: 14, fontWeight: '700', color: ED.ink, letterSpacing: -0.3, marginBottom: 3 },
    recReason: { fontSize: 12, color: ED.ink2, lineHeight: 17 },
    recScore: { fontFamily: MONO_FONT, fontSize: 12, fontWeight: '700', color: ED.copper, minWidth: 34, textAlign: 'right' },

    versusSub: { fontSize: 13, color: ED.ink3, marginBottom: 12 },
    versusRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    versusCard: { flex: 1, padding: 10 },
    vsLabel: {
        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
        fontSize: 16, fontWeight: '700', color: ED.ink3, fontStyle: 'italic',
    },
    versusCover: {
        width: '100%', height: 110, borderRadius: 6,
        overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
    },
    versusCoverGlow: {
        position: 'absolute', bottom: -20, right: -20,
        width: 80, height: 80, borderRadius: 40, opacity: 0.5,
    },
    versusCoverLabel: {
        fontFamily: MONO_FONT, fontSize: 9, fontWeight: '600',
        color: ED.ink3, textAlign: 'center', paddingHorizontal: 8,
        letterSpacing: 0.5, textTransform: 'uppercase',
    },
    versusTitle: { fontSize: 13, fontWeight: '600', color: ED.ink, marginTop: 8, letterSpacing: -0.2 },
    versusMeta: { fontFamily: MONO_FONT, fontSize: 10, color: ED.ink3, marginTop: 3 },
    versusPickBtn: {
        marginTop: 10, height: 30, borderRadius: 8,
        borderWidth: 1, borderColor: ED.copperLine,
        backgroundColor: ED.copperBg,
        alignItems: 'center', justifyContent: 'center',
    },
    versusPickBtnActive: { backgroundColor: ED.copper, borderColor: ED.copper },
    versusPickText: { fontSize: 11, fontWeight: '700', color: ED.copper },
    versusPickTextActive: { color: '#1A1108' },
    versusMsg: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingVertical: 8, paddingHorizontal: 12,
        borderRadius: 8, backgroundColor: ED.mossBg,
        marginBottom: 10,
    },
    versusMsgText: { fontSize: 12, fontWeight: '600', color: ED.moss },

    colHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, paddingBottom: 10 },
    colTitle: { fontSize: 16, fontWeight: '700', color: ED.ink, letterSpacing: -0.4 },
    colSub: { fontSize: 11, color: ED.ink3, marginTop: 2 },
    colCovers: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingBottom: 14 },

    dailyInner: { flexDirection: 'row', gap: 12, padding: 14, alignItems: 'center' },
    dailyTitle: { fontSize: 15, fontWeight: '700', color: ED.ink, letterSpacing: -0.3, marginBottom: 3 },
    dailyReason: { fontSize: 12, color: ED.ink2, lineHeight: 17, marginBottom: 4 },
    dailyStreak: { fontFamily: MONO_FONT, fontSize: 10, fontWeight: '600', color: ED.amber, letterSpacing: 0.4, textTransform: 'uppercase' },

    planRow: { flexDirection: 'row', gap: 12, padding: 14, alignItems: 'center' },
    planDay: { width: 40 },
    planDayLabel: { fontFamily: MONO_FONT, fontSize: 11, fontWeight: '600', color: ED.copper },
    planDaySub: { fontFamily: MONO_FONT, fontSize: 9, color: ED.ink3, marginTop: 2 },
    planTitle: { fontSize: 13.5, fontWeight: '600', color: ED.ink, letterSpacing: -0.2, marginBottom: 2 },
    planNote: { fontSize: 11, color: ED.ink3, fontStyle: 'italic' },

    missionRow: { flexDirection: 'row', gap: 12, padding: 14, alignItems: 'center' },
    missionIcon: {
        width: 32, height: 32, borderRadius: 8,
        backgroundColor: ED.surface2,
        alignItems: 'center', justifyContent: 'center',
    },
    missionTitle: { fontSize: 13, fontWeight: '600', color: ED.ink, letterSpacing: -0.2, marginBottom: 2 },
    missionDesc: { fontSize: 11, color: ED.ink3 },

    tasteTitle: {
        fontSize: 22, fontStyle: 'italic', fontWeight: '700',
        color: ED.ink, letterSpacing: -0.5, lineHeight: 26,
    },
    tasteSummary: { fontSize: 13, color: ED.ink2, marginTop: 10, lineHeight: 20 },
});
