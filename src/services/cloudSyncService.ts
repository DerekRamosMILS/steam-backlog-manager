import * as FileSystem from 'expo-file-system';
import { getDatabase } from '../database/schema';

// Local file backup. There is no server: export writes a JSON file the user keeps,
// import reads one back. Nothing leaves the device unless the user shares the file.

export const exportData = async (): Promise<string> => {
    try {
        const db = getDatabase();
        // getAllSync returns an array of rows
        const rows = db.getAllSync('SELECT * FROM games;');
        const backupData = JSON.stringify(rows);
        const path = `${FileSystem.documentDirectory}backup_${Date.now()}.json`;
        await FileSystem.writeAsStringAsync(path, backupData);
        return path;
    } catch (e) {
        console.error('Failed to export backup', e);
        throw e;
    }
};

interface BackupRow {
    id: number;
    steam_app_id: number;
    title: string;
    cover_url: string | null;
    status: string | null;
    priority: string | null;
    platform: string | null;
    playtime_minutes: number | null;
    hltb_main_story: number | null;
    hltb_completionist: number | null;
    hltb_extra: number | null;
    last_played: string | null;
    added_at: string | null;
    notes: string | null;
    progress_percentage: number | null;
    sort_order: number | null;
    exclude_from_backlog: number | null;
}

/**
 * A backup file is user-supplied and picked from disk, so it can be anything.
 * Reject malformed payloads before touching the database.
 */
const parseBackup = (fileContent: string): BackupRow[] => {
    let parsed: unknown;
    try {
        parsed = JSON.parse(fileContent);
    } catch {
        throw new Error('Backup file is not valid JSON.');
    }

    if (!Array.isArray(parsed)) {
        throw new Error('Backup file does not contain a list of games.');
    }

    return parsed.map((row, index) => {
        if (typeof row !== 'object' || row === null) {
            throw new Error(`Entry ${index + 1} is not a game record.`);
        }
        const candidate = row as Record<string, unknown>;
        if (typeof candidate.id !== 'number' || !Number.isFinite(candidate.id)) {
            throw new Error(`Entry ${index + 1} is missing a numeric id.`);
        }
        if (typeof candidate.title !== 'string' || !candidate.title.trim()) {
            throw new Error(`Entry ${index + 1} is missing a title.`);
        }
        if (typeof candidate.steam_app_id !== 'number' || !Number.isFinite(candidate.steam_app_id)) {
            throw new Error(`Entry ${index + 1} is missing a numeric steam_app_id.`);
        }
        return candidate as unknown as BackupRow;
    });
};

export const importData = async (backupPath: string): Promise<boolean> => {
    try {
        const fileContent = await FileSystem.readAsStringAsync(backupPath);
        const data = parseBackup(fileContent);

        // Snapshot the current library so a bad import can be rolled back by the user.
        const safetyCopy = await exportData();
        console.log('[cloudSync] pre-import snapshot at', safetyCopy);

        const db = getDatabase();
        // A robust solution would handle conflicts (e.g., upsert based on SteamAppId or existing ID)

        // Execute inserts within a transaction for performance
        db.withTransactionSync(() => {
            const statement = db.prepareSync(
                `INSERT OR REPLACE INTO games (id, steam_app_id, title, cover_url, status, priority, platform, playtime_minutes, hltb_main_story, hltb_completionist, hltb_extra, last_played, added_at, notes, progress_percentage, sort_order, exclude_from_backlog)
                 VALUES ($id, $steam_app_id, $title, $cover_url, $status, $priority, $platform, $playtime_minutes, $hltb_main_story, $hltb_completionist, $hltb_extra, $last_played, $added_at, $notes, $progress_percentage, $sort_order, $exclude_from_backlog)`
            );

            try {
                for (const game of data) {
                    statement.executeSync({
                        $id: game.id,
                        $steam_app_id: game.steam_app_id,
                        $title: game.title,
                        $cover_url: game.cover_url,
                        $status: game.status,
                        $priority: game.priority,
                        $platform: game.platform ?? 'steam',
                        $playtime_minutes: game.playtime_minutes ?? 0,
                        $hltb_main_story: game.hltb_main_story ?? null,
                        $hltb_completionist: game.hltb_completionist ?? null,
                        $hltb_extra: game.hltb_extra ?? null,
                        $last_played: game.last_played ?? null,
                        $added_at: game.added_at,
                        $notes: game.notes ?? '',
                        $progress_percentage: game.progress_percentage ?? 0,
                        $sort_order: game.sort_order ?? 0,
                        $exclude_from_backlog: game.exclude_from_backlog ?? 0
                    });
                }
            } finally {
                statement.finalizeSync();
            }
        });

        return true;
    } catch (e) {
        console.error('Failed to import backup', e);
        return false;
    }
};
