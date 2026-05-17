import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { calculateCompletionTimeline, PlannerSimulation } from '../../src/services/plannerService';
import { getBacklogStats } from '../../src/database/queries';
import { useAppContext } from '../../src/hooks/useAppContext';
import { t } from '../../src/i18n';
import { BacklogStats } from '../../src/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { ED, edStyles, MONO_FONT } from '../../src/styles/editorial';

/**
 * Planner tab — kept for back-compat (hidden from tab bar in _layout).
 * Editorial styled with ED tokens.
 */
export default function PlannerScreen() {
    const { language } = useAppContext();
    const router = useRouter();
    const [hoursPerDay, setHoursPerDay] = useState('2');
    const [simulation, setSimulation] = useState<PlannerSimulation | null>(null);
    const [stats, setStats] = useState<BacklogStats | null>(null);

    useFocusEffect(
        React.useCallback(() => {
            setStats(getBacklogStats());
            updateSimulation(parseFloat(hoursPerDay) || 2);
        }, [])
    );

    const updateSimulation = (hours: number) => {
        if (hours > 0) setSimulation(calculateCompletionTimeline(hours));
    };

    const handleApplySim = () => {
        const hours = parseFloat(hoursPerDay);
        if (!isNaN(hours) && hours > 0) updateSimulation(hours);
    };

    return (
        <View style={s.root}>
            <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
                <View style={s.header}>
                    <Text style={[edStyles.eyebrow, { color: ED.copper }]}>PLANNER</Text>
                    <Text style={s.title}>{t('plan_page_title', language)}</Text>
                    <Text style={s.subtitle}>{t('plan_subtitle', language)}</Text>
                </View>

                {/* Sim engine */}
                <View style={s.section}>
                    <Text style={[edStyles.eyebrow, { marginBottom: 10 }]}>SIMULATION ENGINE</Text>
                    <View style={[edStyles.card, { padding: 16 }]}>
                        <Text style={s.label}>{t('plan_hours_label', language)}</Text>
                        <View style={s.inputRow}>
                            <TextInput
                                style={s.input}
                                value={hoursPerDay}
                                onChangeText={setHoursPerDay}
                                keyboardType="numeric"
                                maxLength={4}
                                placeholderTextColor={ED.ink4}
                            />
                            <TouchableOpacity style={s.simBtn} onPress={handleApplySim} activeOpacity={0.85}>
                                <Text style={s.simBtnText}>{t('plan_simulate', language)}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Projections */}
                {stats && simulation && (
                    <View style={s.section}>
                        <Text style={[edStyles.eyebrow, { marginBottom: 10 }]}>PROJECTIONS</Text>
                        <View style={[edStyles.card, { padding: 18 }]}>
                            <Text style={s.statValue}>
                                {stats.total_hours_remaining}<Text style={s.statUnit}>{t('plan_hrs', language)}</Text>
                            </Text>
                            <Text style={s.statLabel}>{t('plan_total_remaining', language)}</Text>

                            <View style={s.divider} />

                            <Text style={[s.statValue, { color: ED.copper, fontSize: 32 }]}>
                                {simulation.monthsToComplete.toFixed(1)}<Text style={s.statUnit}> {t('plan_months', language)}</Text>
                            </Text>
                            <Text style={s.statLabel}>{t('plan_clear_backlog', language)}</Text>

                            <View style={s.divider} />

                            <Text style={[s.statValue, { color: ED.moss, fontSize: 20 }]}>
                                {simulation.estimatedDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                            </Text>
                            <Text style={s.statLabel}>{t('plan_target_date', language)}</Text>
                        </View>
                    </View>
                )}

                {/* Purchase Advisor */}
                <View style={s.section}>
                    <Text style={[edStyles.eyebrow, { marginBottom: 10 }]}>{t('pa_card_title', language).toUpperCase()}</Text>
                    <TouchableOpacity
                        onPress={() => router.push('/purchase-advisor' as any)}
                        activeOpacity={0.85}
                    >
                        <View style={[edStyles.card, { padding: 16, borderColor: ED.plum + '44' }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                                <View style={s.advisorIcon}>
                                    <Ionicons name="help-circle" size={22} color={ED.plum} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.advisorTitle}>{t('pa_card_title', language)}</Text>
                                    <Text style={s.advisorDesc}>{t('pa_card_desc', language)}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={16} color={ED.plum} />
                            </View>
                            <TouchableOpacity
                                style={s.advisorBtn}
                                onPress={() => router.push('/purchase-advisor' as any)}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="analytics" size={14} color="#1A1108" />
                                <Text style={s.advisorBtnText}>{t('pa_card_btn', language)}</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </View>

                <View style={{ height: 120 }} />
            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: ED.bg },
    scroll: { paddingTop: Platform.OS === 'ios' ? 64 : 48, paddingHorizontal: 20 },
    header: { marginBottom: 24, gap: 4 },
    title: { fontSize: 32, fontWeight: '800', letterSpacing: -1.2, color: ED.ink, marginTop: 6 },
    subtitle: { fontSize: 13, color: ED.ink3, marginTop: 2 },
    section: { marginBottom: 22 },
    label: { fontSize: 12, color: ED.ink3, marginBottom: 10 },
    inputRow: { flexDirection: 'row', gap: 10 },
    input: {
        flex: 1, height: 46, borderRadius: 12, borderWidth: 1,
        borderColor: ED.copperLine, backgroundColor: ED.copperBg,
        paddingHorizontal: 14, fontSize: 16, fontWeight: '700', color: ED.ink,
    },
    simBtn: {
        paddingHorizontal: 18, height: 46, borderRadius: 12,
        backgroundColor: ED.copper, justifyContent: 'center', alignItems: 'center',
    },
    simBtnText: { color: '#1A1108', fontSize: 14, fontWeight: '700' },
    statValue: { fontFamily: MONO_FONT, fontSize: 24, fontWeight: '800', color: ED.ink, letterSpacing: -0.8 },
    statUnit: { fontSize: 14, color: ED.ink3, fontWeight: '500' },
    statLabel: { fontSize: 11, color: ED.ink3, marginTop: 4 },
    divider: { height: 1, backgroundColor: ED.line, marginVertical: 14 },
    advisorIcon: {
        width: 44, height: 44, borderRadius: 12,
        backgroundColor: ED.plumBg, borderWidth: 1, borderColor: ED.plum + '40',
        alignItems: 'center', justifyContent: 'center',
    },
    advisorTitle: { fontSize: 14, fontWeight: '700', color: ED.ink, marginBottom: 3 },
    advisorDesc: { fontSize: 11, color: ED.ink3, lineHeight: 16 },
    advisorBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, height: 38, borderRadius: 10,
        backgroundColor: ED.plum, marginTop: 14,
    },
    advisorBtnText: { color: '#1A1108', fontSize: 13, fontWeight: '700' },
});
