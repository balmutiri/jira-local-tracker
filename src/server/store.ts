import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = join(process.cwd(), 'data');
const STORE_PATH = join(DATA_DIR, 'store.json');

export interface TrackedIssue {
  key: string;
  summary: string;
  status: string;
  statusCategory: string;
  priority: string;
  assignee: string;
  issueType: string;
  updated: string;
  url: string;
}

export interface IssueTracking {
  notes: string;
  localLabel: string;
  /** Local-only workflow status (never written to Jira). */
  myStatus: string;
  pinned: boolean;
  lastSeenStatus: string;
  statusHistory: { status: string; at: string }[];
  updatedAt: string;
}

export interface AiInsights {
  summary: string;
  highlights: string[];
  risks: string[];
  generatedAt: string;
  source: 'local' | 'openai';
}

export interface Store {
  issues: TrackedIssue[];
  tracking: Record<string, IssueTracking>;
  lastSync: string | null;
  aiInsights: AiInsights | null;
}

const emptyStore = (): Store => ({
  issues: [],
  tracking: {},
  lastSync: null,
  aiInsights: null,
});

export function ensureStore(): Store {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!existsSync(STORE_PATH)) {
    const store = emptyStore();
    writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
    return store;
  }
  const raw = JSON.parse(readFileSync(STORE_PATH, 'utf8')) as Partial<Store>;
  const tracking: Record<string, IssueTracking> = {};
  for (const [key, value] of Object.entries(raw.tracking ?? {})) {
    tracking[key] = {
      notes: value?.notes ?? '',
      localLabel: value?.localLabel ?? '',
      myStatus: value?.myStatus ?? '',
      pinned: value?.pinned ?? false,
      lastSeenStatus: value?.lastSeenStatus ?? '',
      statusHistory: value?.statusHistory ?? [],
      updatedAt: value?.updatedAt ?? new Date().toISOString(),
    };
  }
  return {
    issues: raw.issues ?? [],
    tracking,
    lastSync: raw.lastSync ?? null,
    aiInsights: raw.aiInsights ?? null,
  };
}

export function saveStore(store: Store): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}
