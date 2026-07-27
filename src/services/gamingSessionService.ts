import { logGamingSession, updateGame } from '../database/queries';
import { Game } from '../types';
import { markDailyPickPlayed } from './recommendationService';
import { evaluateGamingSession } from './challengeService';

export function logSessionAndUpdateGame(game: Game, minutes: number, notes?: string): void {
    // 1. Log the session
    logGamingSession(game.id, minutes, notes);

    // 2. Fetch the new total playtime or just add to current
    const newTotal = game.playtime_minutes + minutes;

    // 3. Update the game in DB
    const now = new Date().toISOString();
    updateGame(game.id, {
        status: game.status === 'not_started' || game.status === 'up_next' ? 'playing' : game.status,
        playtime_minutes: newTotal,
        last_played: now
    });

    markDailyPickPlayed(game.id);
    evaluateGamingSession(minutes);
}
