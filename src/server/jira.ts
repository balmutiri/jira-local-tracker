import type { AiInsights, TrackedIssue } from './store';

const DUMMY_MARKERS = ['dummy', 'replace_me', 'your_jira', 'example.com'];

export function isDummyConfig(): boolean {
  const token = process.env['JIRA_API_TOKEN'] ?? '';
  const email = process.env['JIRA_EMAIL'] ?? '';
  const base = process.env['JIRA_BASE_URL'] ?? '';
  return (
    !token ||
    !email ||
    !base ||
    DUMMY_MARKERS.some(
      (m) =>
        token.toLowerCase().includes(m) ||
        email.toLowerCase().includes(m) ||
        base.toLowerCase().includes(m),
    )
  );
}

export function getDummyIssues(): TrackedIssue[] {
  const base = (process.env['JIRA_BASE_URL'] || 'https://your-domain.atlassian.net').replace(
    /\/$/,
    '',
  );
  const now = Date.now();
  return [
    {
      key: 'DEMO-101',
      summary: 'Design local Jira dashboard layout',
      status: 'In Progress',
      statusCategory: 'indeterminate',
      priority: 'High',
      assignee: 'You',
      issueType: 'Story',
      updated: new Date(now - 1000 * 60 * 40).toISOString(),
      url: `${base}/browse/DEMO-101`,
    },
    {
      key: 'DEMO-102',
      summary: 'Persist tracking notes across restarts',
      status: 'To Do',
      statusCategory: 'new',
      priority: 'Medium',
      assignee: 'You',
      issueType: 'Task',
      updated: new Date(now - 1000 * 60 * 60 * 5).toISOString(),
      url: `${base}/browse/DEMO-102`,
    },
    {
      key: 'DEMO-103',
      summary: 'Wire AI status insights for stalled work',
      status: 'In Progress',
      statusCategory: 'indeterminate',
      priority: 'Highest',
      assignee: 'You',
      issueType: 'Story',
      updated: new Date(now - 1000 * 60 * 60 * 26).toISOString(),
      url: `${base}/browse/DEMO-103`,
    },
    {
      key: 'DEMO-104',
      summary: 'Add filter chips by status category',
      status: 'Done',
      statusCategory: 'done',
      priority: 'Low',
      assignee: 'You',
      issueType: 'Task',
      updated: new Date(now - 1000 * 60 * 60 * 48).toISOString(),
      url: `${base}/browse/DEMO-104`,
    },
    {
      key: 'DEMO-105',
      summary: 'Review blocked dependency with design',
      status: 'Blocked',
      statusCategory: 'indeterminate',
      priority: 'High',
      assignee: 'You',
      issueType: 'Bug',
      updated: new Date(now - 1000 * 60 * 60 * 72).toISOString(),
      url: `${base}/browse/DEMO-105`,
    },
    {
      key: 'DEMO-106',
      summary: 'Document env setup for API token',
      status: 'To Do',
      statusCategory: 'new',
      priority: 'Medium',
      assignee: 'You',
      issueType: 'Task',
      updated: new Date(now - 1000 * 60 * 15).toISOString(),
      url: `${base}/browse/DEMO-106`,
    },
  ];
}

export async function fetchJiraIssues(): Promise<{
  issues: TrackedIssue[];
  mode: 'live' | 'dummy';
}> {
  if (isDummyConfig()) {
    return { issues: getDummyIssues(), mode: 'dummy' };
  }

  const base = (process.env['JIRA_BASE_URL'] || '').replace(/\/$/, '');
  const email = process.env['JIRA_EMAIL'] || '';
  const token = process.env['JIRA_API_TOKEN'] || '';
  const jql = process.env['JIRA_JQL'] || 'assignee = currentUser() ORDER BY updated DESC';
  const auth = Buffer.from(`${email}:${token}`).toString('base64');

  const res = await fetch(`${base}/rest/api/3/search/jql`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jql,
      maxResults: 50,
      fields: [
        'summary',
        'status',
        'priority',
        'assignee',
        'issuetype',
        'updated',
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Jira API ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    issues?: Array<{
      key: string;
      fields: {
        summary: string;
        status?: { name?: string; statusCategory?: { key?: string } };
        priority?: { name?: string };
        assignee?: { displayName?: string };
        issuetype?: { name?: string };
        updated?: string;
      };
    }>;
  };

  const issues: TrackedIssue[] = (data.issues ?? []).map((issue) => ({
    key: issue.key,
    summary: issue.fields.summary,
    status: issue.fields.status?.name || 'Unknown',
    statusCategory: issue.fields.status?.statusCategory?.key || 'new',
    priority: issue.fields.priority?.name || 'None',
    assignee: issue.fields.assignee?.displayName || 'Unassigned',
    issueType: issue.fields.issuetype?.name || 'Task',
    updated: issue.fields.updated || new Date().toISOString(),
    url: `${base}/browse/${issue.key}`,
  }));

  return { issues, mode: 'live' };
}

function buildLocalInsights(issues: TrackedIssue[]): AiInsights {
  const byCategory = issues.reduce<Record<string, number>>((acc, i) => {
    acc[i.status] = (acc[i.status] || 0) + 1;
    return acc;
  }, {});

  const dayMs = 1000 * 60 * 60 * 24;
  const stalled = issues.filter((i) => {
    if (i.statusCategory === 'done') return false;
    return Date.now() - new Date(i.updated).getTime() > dayMs;
  });

  const highPriorityOpen = issues.filter(
    (i) =>
      i.statusCategory !== 'done' &&
      ['Highest', 'High', 'Critical'].includes(i.priority),
  );

  const blocked = issues.filter((i) =>
    /block|hold|wait/i.test(i.status),
  );

  const highlights: string[] = [
    `${issues.length} issues synced · ${Object.entries(byCategory)
      .map(([k, v]) => `${v} ${k}`)
      .join(', ')}`,
  ];

  if (highPriorityOpen.length) {
    highlights.push(
      `${highPriorityOpen.length} high-priority open: ${highPriorityOpen
        .slice(0, 3)
        .map((i) => i.key)
        .join(', ')}`,
    );
  }

  const risks: string[] = [];
  if (stalled.length) {
    risks.push(
      `${stalled.length} issue(s) idle >24h: ${stalled
        .slice(0, 4)
        .map((i) => i.key)
        .join(', ')}`,
    );
  }
  if (blocked.length) {
    risks.push(
      `Blocked/waiting: ${blocked.map((i) => i.key).join(', ')}`,
    );
  }
  if (!risks.length) {
    risks.push('No obvious stalls — board looks healthy.');
  }

  const inProgress = issues.filter((i) => i.statusCategory === 'indeterminate').length;
  const todo = issues.filter((i) => i.statusCategory === 'new').length;
  const done = issues.filter((i) => i.statusCategory === 'done').length;

  return {
    summary: `Focus: ${inProgress} in flight, ${todo} queued, ${done} done. ${
      stalled.length
        ? `Revisit ${stalled[0].key} first — quietest active item.`
        : 'Keep momentum on current in-progress work.'
    }`,
    highlights,
    risks,
    generatedAt: new Date().toISOString(),
    source: 'local',
  };
}

export async function generateAiInsights(
  issues: TrackedIssue[],
): Promise<AiInsights> {
  const key = process.env['OPENAI_API_KEY'] || '';
  const isDummyKey =
    !key ||
    DUMMY_MARKERS.some((m) => key.toLowerCase().includes(m));

  if (isDummyKey) {
    return buildLocalInsights(issues);
  }

  try {
    const prompt = `You are a concise delivery coach. Given these Jira issues as JSON, return JSON with keys summary (1-2 sentences), highlights (string array, max 4), risks (string array, max 4). No markdown.\n${JSON.stringify(
      issues.map((i) => ({
        key: i.key,
        summary: i.summary,
        status: i.status,
        priority: i.priority,
        updated: i.updated,
      })),
    )}`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        messages: [
          { role: 'system', content: 'Respond with valid JSON only.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      return buildLocalInsights(issues);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content) as {
      summary?: string;
      highlights?: string[];
      risks?: string[];
    };

    return {
      summary: parsed.summary || buildLocalInsights(issues).summary,
      highlights: parsed.highlights || [],
      risks: parsed.risks || [],
      generatedAt: new Date().toISOString(),
      source: 'openai',
    };
  } catch {
    return buildLocalInsights(issues);
  }
}
