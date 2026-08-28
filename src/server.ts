import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchJiraIssues, generateAiInsights, isDummyConfig } from './server/jira';
import { loadEnvFile } from './server/load-env';
import { ensureStore, saveStore, type IssueTracking } from './server/store';

loadEnvFile();

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    dummyMode: isDummyConfig(),
    emailConfigured: Boolean(process.env['JIRA_EMAIL']),
  });
});

app.get('/api/board', (_req, res) => {
  const store = ensureStore();
  res.json({
    ...store,
    dummyMode: isDummyConfig(),
  });
});

app.post('/api/sync', async (_req, res) => {
  try {
    const { issues, mode } = await fetchJiraIssues();
    const store = ensureStore();
    const now = new Date().toISOString();

    for (const issue of issues) {
      const existing = store.tracking[issue.key];
      if (!existing) {
        store.tracking[issue.key] = {
          notes: '',
          localLabel: '',
          myStatus: '',
          pinned: false,
          lastSeenStatus: issue.status,
          statusHistory: [{ status: issue.status, at: now }],
          updatedAt: now,
        };
      } else if (existing.lastSeenStatus !== issue.status) {
        existing.statusHistory.push({ status: issue.status, at: now });
        existing.lastSeenStatus = issue.status;
        existing.updatedAt = now;
      }
    }

    store.issues = issues;
    store.lastSync = now;
    store.aiInsights = await generateAiInsights(issues);
    saveStore(store);

    res.json({
      ...store,
      dummyMode: mode === 'dummy' || isDummyConfig(),
      synced: issues.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed';
    res.status(502).json({ error: message });
  }
});

app.patch('/api/tracking/:key', (req, res) => {
  const key = req.params['key'];
  const store = ensureStore();
  const body = req.body as Partial<IssueTracking>;
  const now = new Date().toISOString();
  const current = store.tracking[key] || {
    notes: '',
    localLabel: '',
    myStatus: '',
    pinned: false,
    lastSeenStatus: store.issues.find((i) => i.key === key)?.status || '',
    statusHistory: [],
    updatedAt: now,
  };

  store.tracking[key] = {
    ...current,
    notes: body.notes ?? current.notes,
    localLabel: body.localLabel ?? current.localLabel,
    myStatus: body.myStatus ?? current.myStatus,
    pinned: body.pinned ?? current.pinned,
    updatedAt: now,
  };
  saveStore(store);
  res.json(store.tracking[key]);
});

app.post('/api/ai', async (_req, res) => {
  try {
    const store = ensureStore();
    if (!store.issues.length) {
      res.status(400).json({ error: 'Sync issues first.' });
      return;
    }
    store.aiInsights = await generateAiInsights(store.issues);
    saveStore(store);
    res.json(store.aiInsights);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI failed';
    res.status(500).json({ error: message });
  }
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use('/**', (req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * The request handler used by the Angular CLI (dev-server and during build).
 */
export const reqHandler = createNodeRequestHandler(app);
