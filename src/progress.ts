import fs from 'node:fs/promises';
import path from 'node:path';

export interface VideoProgress {
  videoPath: string;
  lastPlaybackPosition: number;
}

const PROGRESS_FILE_PATH = path.join(process.cwd(), 'storage', 'progress.json');

const ensureProgressFileExists = async (): Promise<void> => {
  try {
    await fs.access(PROGRESS_FILE_PATH);
  } catch {
    // File doesn't exist, create it with empty array
    await fs.mkdir(path.dirname(PROGRESS_FILE_PATH), { recursive: true });
    await fs.writeFile(PROGRESS_FILE_PATH, JSON.stringify([], null, 2));
  }
};

const readProgressFile = async (): Promise<VideoProgress[]> => {
  await ensureProgressFileExists();
  try {
    const data = await fs.readFile(PROGRESS_FILE_PATH, 'utf-8');
    return JSON.parse(data) as VideoProgress[];
  } catch (error) {
    console.error('Error reading progress file:', error);
    return [];
  }
}

const writeProgressFile = async (progress: VideoProgress[]): Promise<void> => {
  try {
    await fs.writeFile(PROGRESS_FILE_PATH, JSON.stringify(progress, null, 2));
  } catch (error) {
    console.error('Error writing progress file:', error);
    throw error;
  }
};

export const savePlaybackProgress = async (videoPath: string, position: number): Promise<void> => {
  const progressData = await readProgressFile();

  // Find existing entry for this video
  const existingIndex = progressData.findIndex(item => item.videoPath === videoPath);

  if (existingIndex >= 0) {
    // Update existing entry
    progressData[existingIndex].lastPlaybackPosition = position;
  } else {
    // Add new entry
    progressData.push({
      videoPath,
      lastPlaybackPosition: position
    });
  }

  await writeProgressFile(progressData);
}

export const loadPlaybackProgress = async (videoPath: string): Promise<number> => {
  const progressData = await readProgressFile();
  const entry = progressData.find(item => item.videoPath === videoPath);
  return entry?.lastPlaybackPosition ?? 0;
};

export const removePlaybackProgress = async (videoPath: string): Promise<void> => {
  const progressData = await readProgressFile();
  const filteredData = progressData.filter(item => item.videoPath !== videoPath);
  await writeProgressFile(filteredData);
};

export const getAllProgress = async (): Promise<VideoProgress[]> => {
  return await readProgressFile();
};
