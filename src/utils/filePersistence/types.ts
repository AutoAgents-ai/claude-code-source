export const DEFAULT_UPLOAD_CONCURRENCY = 5;
export const FILE_COUNT_LIMIT = 100;
export const OUTPUTS_SUBDIR = '.outputs';
export type FailedPersistence = { file: string; error: string };
export type FilesPersistedEventData = Record<string, unknown>;
export type PersistedFile = { path: string; fileId?: string };
export type TurnStartTime = number;
export type FilePersistenceConfig = unknown;
