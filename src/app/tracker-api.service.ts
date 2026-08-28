import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AiInsights, BoardState, IssueTracking } from './models';

@Injectable({ providedIn: 'root' })
export class TrackerApiService {
  private readonly http = inject(HttpClient);

  getBoard(): Observable<BoardState> {
    return this.http.get<BoardState>('/api/board');
  }

  sync(): Observable<BoardState> {
    return this.http.post<BoardState>('/api/sync', {});
  }

  updateTracking(
    key: string,
    patch: Partial<Pick<IssueTracking, 'notes' | 'localLabel' | 'myStatus' | 'pinned'>>,
  ): Observable<IssueTracking> {
    return this.http.patch<IssueTracking>(`/api/tracking/${encodeURIComponent(key)}`, patch);
  }

  refreshAi(): Observable<AiInsights> {
    return this.http.post<AiInsights>('/api/ai', {});
  }
}
