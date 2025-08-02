import fs from 'node:fs/promises';
import path from 'node:path';

export interface VideoProgress {
  videoPath: string;
  lastPlaybackPosition: number;
}

type ProgressData = {
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

export class VideoProgressStore {
  private progressData: ProgressData = {};

  private constructor(progressData: ProgressData) {
    this.progressData = progressData;
  }

  static async load(): Promise<VideoProgressStore> {
    await ensureProgressFileExists();
    const data = await fs.readFile(PROGRESS_FILE_PATH, 'utf-8');
    const progressData = JSON.parse(data) as ProgressData;
    return new VideoProgressStore(progressData);
  }

  public async saveStore(): Promise<void> {
    await fs.writeFile(PROGRESS_FILE_PATH, JSON.stringify(this.progressData, null, 2));
  }

  public getVideoProgress(videoPath: string): number {
    return this.progressData[videoPath]?.lastPlaybackPosition ?? 0;
  }

  public saveVideoProgress(videoPath: string, position: number): void {
    this.progressData[videoPath] = { lastPlaybackPosition: position };
    this.saveStore();
  }

  public deleteVideoProgress(videoPath: string): void {
    delete this.progressData[videoPath];
    this.saveStore();
  }
}
