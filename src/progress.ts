import fs from 'node:fs/promises';
import path from 'node:path';

export interface VideoProgress {
  videoPath: string;
  lastPlaybackPosition: number;
}

export type StoredProgress = {
  [videoPath in string]?: {
    lastPlaybackPosition: number;
  };
}

const PROGRESS_FILE_PATH = path.join(process.cwd(), 'storage', 'progress.json');

const ensureProgressFileExists = async (): Promise<void> => {
  try {
    await fs.access(PROGRESS_FILE_PATH);
  } catch {
    // File doesn't exist, create it with empty object
    await fs.mkdir(path.dirname(PROGRESS_FILE_PATH), { recursive: true });
    await fs.writeFile(PROGRESS_FILE_PATH, JSON.stringify({}, null, 2));
  }
};

export const loadStoredProgress = async (): Promise<StoredProgress> => {
  await ensureProgressFileExists();
  try {
    const data = await fs.readFile(PROGRESS_FILE_PATH, 'utf-8');
    return JSON.parse(data) as StoredProgress;
  } catch (error) {
    console.error('Error reading progress file:', error);
    return {};
  }
};

const writeProgressFile = async (progress: StoredProgress): Promise<void> => {
  try {
    await fs.writeFile(PROGRESS_FILE_PATH, JSON.stringify(progress, null, 2));
  } catch (error) {
    console.error('Error writing progress file:', error);
    throw error;
  }
};

export const savePlaybackProgress = async (videoPath: string, position: number): Promise<void> => {
  const progressData = await loadStoredProgress();

  // Update or add entry for this video
  progressData[videoPath] = {
    lastPlaybackPosition: position
  };

  await writeProgressFile(progressData);
}

export const loadPlaybackProgress = async (videoPath: string): Promise<number> => {
  const progressData = await loadStoredProgress();
  return progressData[videoPath]?.lastPlaybackPosition ?? 0;
};

export const removePlaybackProgress = async (videoPath: string): Promise<void> => {
  const progressData = await loadStoredProgress();
  delete progressData[videoPath];
  await writeProgressFile(progressData);
};
