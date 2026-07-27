import { getChallengesForMonth, upsertChallenge } from '../database/queries';
import { BacklogChallenge, Game } from '../types';

export const CHALLENGE_TYPES = ['games_completed', 'hours_played', 'hltb_target_met'] as const;
export type ChallengeType = (typeof CHALLENGE_TYPES)[number];

export function currentMonthKey(date = new Date()): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function getCurrentMonthChallenges(): BacklogChallenge[] {
    const monthYear = currentMonthKey();
    let challenges = getChallengesForMonth(monthYear);

    // Create default challenges if none exist
    if (challenges.length === 0) {
        const defaults: { type: ChallengeType; target: number }[] = [
            { type: 'games_completed', target: 3 },
            { type: 'hours_played', target: 30 },
            { type: 'hltb_target_met', target: 2 },
        ];

        for (const c of defaults) {
            upsertChallenge(c.type, c.target, 0, 'active', monthYear);
        }

        challenges = getChallengesForMonth(monthYear);
    }

    return challenges;
}

export function updateChallengeProgress(type: ChallengeType, amount: number): void {
    const monthYear = currentMonthKey();
    // Ensure this month's row exists before trying to advance it.
    const challenge = getCurrentMonthChallenges().find((c) => c.type === type);
    if (!challenge || challenge.status !== 'active') return;

    const newProgress = Math.min(challenge.progress + amount, challenge.target);
    const newStatus = newProgress >= challenge.target ? 'completed' : 'active';

    upsertChallenge(challenge.type, challenge.target, newProgress, newStatus, monthYear);
}

export function evaluateGameCompletion(game: Game): void {
    if (game.status !== 'completed') return;

    updateChallengeProgress('games_completed', 1);

    // Beating a game at or under its HLTB main-story estimate counts as on-target.
    if (game.hltb_main_story && game.playtime_minutes > 0) {
        const hltbMinutes = game.hltb_main_story * 60;
        if (game.playtime_minutes <= hltbMinutes) {
            updateChallengeProgress('hltb_target_met', 1);
        }
    }
}

export function evaluateGamingSession(durationMinutes: number): void {
    if (durationMinutes <= 0) return;
    updateChallengeProgress('hours_played', durationMinutes / 60);
}
