import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ApiResponse } from '../models/api-response.model';
import { InAppNotification } from '../models/admin.model';

import { environment } from '../../../environments/environment';

export interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
}

export interface ConversationSession {
  _id: string;
  userId: string;
  role: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class AIChatService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/ai-chat`;

  readonly historyCleared$ = new Subject<void>();

  getConversations(): Observable<ApiResponse<{ conversations: ConversationSession[] }>> {
    return this.http.get<ApiResponse<{ conversations: ConversationSession[] }>>(
      `${this.baseUrl}/conversations`,
    );
  }

  getConversationById(id: string): Observable<ApiResponse<{ conversation: ConversationSession }>> {
    return this.http.get<ApiResponse<{ conversation: ConversationSession }>>(
      `${this.baseUrl}/conversations/${id}`,
    );
  }

  sendMessage(
    message: string,
    conversationId?: string,
  ): Observable<ApiResponse<{ conversation: ConversationSession; reply: string }>> {
    return this.http.post<ApiResponse<{ conversation: ConversationSession; reply: string }>>(
      `${this.baseUrl}/message`,
      { message, conversationId },
    );
  }

  deleteAllConversations(): Observable<any> {
    return this.http
      .delete(`${this.baseUrl}/conversations`)
      .pipe(tap(() => this.historyCleared$.next()));
  }
}
