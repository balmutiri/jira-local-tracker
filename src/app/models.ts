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

export interface BoardState {
  issues: TrackedIssue[];
  tracking: Record<string, IssueTracking>;
  lastSync: string | null;
  aiInsights: AiInsights | null;
  dummyMode?: boolean;
}
