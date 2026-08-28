import {
  Component,
  OnInit,
  PLATFORM_ID,
  inject,
  signal,
  computed,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TrackerApiService } from './tracker-api.service';
import { AiInsights, BoardState, TrackedIssue } from './models';
import { I18nService } from './i18n/i18n.service';
import {
  Lang,
  MY_STATUS_VALUES,
  TranslationKey,
} from './i18n/translations';

type FilterKey = 'all' | 'new' | 'indeterminate' | 'done';

export interface ChartSlice {
  label: string;
  count: number;
  pct: number;
  color: string;
}

const CHART_COLORS = [
  '#3ecf8e',
  '#7ee0b0',
  '#2aa86f',
  '#1f8f5f',
  '#f0b429',
  '#ff7b72',
  '#93a89b',
  '#c5d5cb',
];

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  private readonly api = inject(TrackerApiService);
  private readonly platformId = inject(PLATFORM_ID);
  readonly i18n = inject(I18nService);

  readonly loading = signal(false);
  readonly syncing = signal(false);
  readonly aiLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly board = signal<BoardState | null>(null);
  readonly filter = signal<FilterKey>('all');
  readonly selectedKey = signal<string | null>(null);
  readonly saveMessage = signal<string | null>(null);
  readonly search = signal('');
  draftNotes = '';
  draftLabel = '';
  draftMyStatus = '';

  readonly myStatusOptions = MY_STATUS_VALUES;

  readonly filterOptions = computed(() => {
    this.i18n.lang();
    return [
      { key: 'all' as FilterKey, label: this.i18n.t('filter.all') },
      { key: 'new' as FilterKey, label: this.i18n.t('filter.todo') },
      { key: 'indeterminate' as FilterKey, label: this.i18n.t('filter.active') },
      { key: 'done' as FilterKey, label: this.i18n.t('filter.done') },
    ];
  });

  readonly issues = computed(() => this.board()?.issues ?? []);
  readonly insights = computed(() => this.board()?.aiInsights ?? null);
  readonly dummyMode = computed(() => Boolean(this.board()?.dummyMode));

  readonly filteredIssues = computed(() => {
    const list = this.issues();
    const f = this.filter();
    const q = this.search().trim().toLowerCase();
    const tracking = this.board()?.tracking ?? {};

    let filtered =
      f === 'all' ? list : list.filter((i) => i.statusCategory === f);

    if (q) {
      filtered = filtered.filter((i) => {
        const mine = tracking[i.key]?.myStatus || '';
        return (
          i.key.toLowerCase().includes(q) ||
          i.summary.toLowerCase().includes(q) ||
          i.assignee.toLowerCase().includes(q) ||
          i.status.toLowerCase().includes(q) ||
          mine.toLowerCase().includes(q) ||
          this.i18n.myStatusLabel(mine).toLowerCase().includes(q)
        );
      });
    }

    return [...filtered].sort((a, b) => {
      const ap = tracking[a.key]?.pinned ? 1 : 0;
      const bp = tracking[b.key]?.pinned ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return new Date(b.updated).getTime() - new Date(a.updated).getTime();
    });
  });

  readonly counts = computed(() => {
    const list = this.issues();
    return {
      all: list.length,
      new: list.filter((i) => i.statusCategory === 'new').length,
      indeterminate: list.filter((i) => i.statusCategory === 'indeterminate')
        .length,
      done: list.filter((i) => i.statusCategory === 'done').length,
    };
  });

  readonly jiraStatusChart = computed(() =>
    this.buildChart(this.issues().map((i) => i.status)),
  );

  readonly myStatusChart = computed(() => {
    this.i18n.lang();
    const tracking = this.board()?.tracking ?? {};
    return this.buildChart(
      this.issues().map((i) => {
        const raw = tracking[i.key]?.myStatus?.trim() || '';
        return raw ? this.i18n.myStatusLabel(raw) : this.i18n.t('status.unset');
      }),
    );
  });

  readonly assigneeChart = computed(() => {
    this.i18n.lang();
    return this.buildChart(
      this.issues().map((i) =>
        i.assignee?.trim() ? i.assignee : this.i18n.t('unassigned'),
      ),
    );
  });

  readonly selected = computed(() => {
    const key = this.selectedKey();
    if (!key) return null;
    return this.issues().find((i) => i.key === key) ?? null;
  });

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.i18n.init();
    this.load();
  }

  t(key: TranslationKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  setLang(lang: Lang): void {
    this.i18n.setLang(lang);
  }

  private buildChart(values: string[]): ChartSlice[] {
    const counts = new Map<string, number>();
    for (const value of values) {
      counts.set(value, (counts.get(value) || 0) + 1);
    }
    const total = values.length || 1;
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([label, count], index) => ({
        label,
        count,
        pct: Math.round((count / total) * 100),
        color: CHART_COLORS[index % CHART_COLORS.length],
      }));
  }

  donutGradient(slices: ChartSlice[]): string {
    if (!slices.length) return 'conic-gradient(#dbe7f3 0 100%)';
    let cursor = 0;
    const parts = slices.map((s) => {
      const start = cursor;
      cursor += s.pct;
      return `${s.color} ${start}% ${cursor}%`;
    });
    if (cursor < 100) {
      parts.push(`rgba(255,255,255,0.06) ${cursor}% 100%`);
    }
    return `conic-gradient(${parts.join(', ')})`;
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getBoard().subscribe({
      next: (board) => {
        this.board.set(board);
        this.loading.set(false);
        if (!board.issues.length) {
          this.sync();
        }
      },
      error: () => {
        this.loading.set(false);
        this.error.set(this.t('error.load'));
      },
    });
  }

  sync(): void {
    this.syncing.set(true);
    this.error.set(null);
    this.api.sync().subscribe({
      next: (board) => {
        this.board.set(board);
        this.syncing.set(false);
      },
      error: () => {
        this.syncing.set(false);
        this.error.set(this.t('error.sync'));
      },
    });
  }

  setFilter(f: FilterKey): void {
    this.filter.set(f);
  }

  countFor(key: FilterKey): number {
    return this.counts()[key];
  }

  openIssue(issue: TrackedIssue): void {
    this.selectedKey.set(issue.key);
    this.saveMessage.set(null);
    const t = this.board()?.tracking?.[issue.key];
    this.draftNotes = t?.notes || '';
    this.draftLabel = t?.localLabel || '';
    this.draftMyStatus = t?.myStatus || '';
  }

  closePanel(): void {
    this.selectedKey.set(null);
    this.saveMessage.set(null);
  }

  saveTracking(): void {
    const key = this.selectedKey();
    if (!key) return;
    this.api
      .updateTracking(key, {
        notes: this.draftNotes,
        localLabel: this.draftLabel,
        myStatus: this.draftMyStatus,
      })
      .subscribe({
        next: (tracking) => {
          const board = this.board();
          if (!board) return;
          this.board.set({
            ...board,
            tracking: { ...board.tracking, [key]: tracking },
          });
          this.saveMessage.set(this.t('save.ok'));
        },
        error: () => this.error.set(this.t('error.save')),
      });
  }

  quickSetMyStatus(issue: TrackedIssue, myStatus: string, event?: Event): void {
    event?.stopPropagation();
    this.api.updateTracking(issue.key, { myStatus }).subscribe({
      next: (tracking) => {
        const board = this.board();
        if (!board) return;
        this.board.set({
          ...board,
          tracking: { ...board.tracking, [issue.key]: tracking },
        });
        if (this.selectedKey() === issue.key) {
          this.draftMyStatus = tracking.myStatus;
        }
      },
      error: () => this.error.set(this.t('error.myStatus')),
    });
  }

  togglePin(issue: TrackedIssue, event: Event): void {
    event.stopPropagation();
    const current = this.board()?.tracking?.[issue.key]?.pinned ?? false;
    this.api.updateTracking(issue.key, { pinned: !current }).subscribe({
      next: (tracking) => {
        const board = this.board();
        if (!board) return;
        this.board.set({
          ...board,
          tracking: { ...board.tracking, [issue.key]: tracking },
        });
      },
    });
  }

  refreshAi(): void {
    this.aiLoading.set(true);
    this.api.refreshAi().subscribe({
      next: (ai: AiInsights) => {
        const board = this.board();
        if (board) this.board.set({ ...board, aiInsights: ai });
        this.aiLoading.set(false);
      },
      error: () => {
        this.aiLoading.set(false);
        this.error.set(this.t('error.ai'));
      },
    });
  }

  trackingFor(key: string) {
    return this.board()?.tracking?.[key];
  }

  categoryClass(cat: string): string {
    if (cat === 'done') return 'cat-done';
    if (cat === 'indeterminate') return 'cat-progress';
    return 'cat-new';
  }

  myStatusClass(status: string): string {
    const s = (status || '').toLowerCase();
    if (!s) return 'mine-unset';
    if (s.includes('done')) return 'mine-done';
    if (s.includes('progress') || s.includes('review')) return 'mine-progress';
    if (s.includes('block') || s.includes('wait')) return 'mine-blocked';
    if (s.includes('pending')) return 'mine-pending';
    return 'mine-unset';
  }

  initials(name: string): string {
    const parts = (name || '?').trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() || '').join('') || '?';
  }
}
