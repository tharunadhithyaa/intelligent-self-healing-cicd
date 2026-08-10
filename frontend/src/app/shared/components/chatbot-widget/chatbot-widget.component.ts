import {
  Component,
  OnInit,
  signal,
  ElementRef,
  ViewChild,
  inject,
  ChangeDetectionStrategy,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AIChatService, ChatMessage } from '../../../core/services/ai-chat.service';
import { AuthService } from '../../../core/services/auth.service';
import { MarkdownPipe } from '../../pipes/markdown.pipe';

@Component({
  selector: 'app-chatbot-widget',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MarkdownPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chatbot-container">
      <!-- Floating Action Button -->
      <button
        class="chatbot-fab animate-pulse"
        (click)="toggleChat()"
        [ngClass]="{ hide: isOpen() }"
        aria-label="Open AI Assistant"
      >
        <mat-icon>chat</mat-icon>
      </button>

      <!-- Chat Modal Panel -->
      <div class="chatbot-panel" [ngClass]="{ open: isOpen() }">
        <!-- Panel Header -->
        <div class="panel-header">
          <div class="header-title">
            <div class="logo-icon" style="background: transparent; padding: 0;">
              <img
                src="logo.jpg"
                alt="Logo"
                style="width: 100%; height: 100%; border-radius: inherit; object-fit: cover;"
              />
            </div>
            <div class="title-text">
              <h4>CivicPulse AI Assistant</h4>
              <span class="status"><span class="status-dot"></span>Online</span>
            </div>
          </div>
          <button class="btn-close" (click)="toggleChat()" aria-label="Minimize Chat">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <!-- Messages List -->
        <div class="messages-list" #scrollContainer>
          @for (m of messages(); track m.timestamp) {
            <div class="message-bubble-wrapper" [ngClass]="m.sender">
              <div class="message-bubble" [ngClass]="m.sender">
                @if (m.sender === 'bot') {
                  <div class="bot-msg-content" [innerHTML]="m.text | markdown"></div>
                } @else {
                  <p>{{ m.text }}</p>
                }
                <span class="time">{{ m.timestamp | date: 'shortTime' }}</span>
              </div>
              @if (m.sender === 'bot') {
                <div class="msg-actions">
                  <button (click)="copyText(m.text)" title="Copy">
                    <mat-icon>content_copy</mat-icon>
                  </button>
                  <button title="Thumbs Up">
                    <mat-icon>thumb_up</mat-icon>
                  </button>
                  <button title="Thumbs Down">
                    <mat-icon>thumb_down</mat-icon>
                  </button>
                  <button title="Regenerate">
                    <mat-icon>refresh</mat-icon>
                  </button>
                </div>
              }
            </div>
          }
          @if (typing()) {
            <div class="message-bubble-wrapper bot">
              <div class="message-bubble typing-bubble">
                <span class="typing-text">CivicPulse AI is thinking</span>
                <span class="dot"></span>
                <span class="dot"></span>
                <span class="dot"></span>
              </div>
            </div>
          }
        </div>

        <!-- Input Box -->
        <div class="input-box">
          <div class="input-wrapper">
            <textarea
              #chatInput
              [(ngModel)]="newMessage"
              (keydown)="onKeydown($event)"
              (input)="autoGrow(chatInput)"
              placeholder="Ask about complaints, services, departments, or civic issues..."
              [disabled]="typing()"
              rows="1"
            ></textarea>
            <div class="char-count" *ngIf="newMessage.length > 0">{{ newMessage.length }}/500</div>
          </div>
          <button
            class="btn-send"
            (click)="sendMessage()"
            [disabled]="!newMessage.trim() || typing() || newMessage.length > 500"
            aria-label="Send Message"
          >
            <mat-icon *ngIf="!typing()">send</mat-icon>
            <mat-icon *ngIf="typing()" class="spinner">autorenew</mat-icon>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      @use 'styles/variables' as *;
      @use 'styles/mixins' as *;

      /* Color Palette (Dynamic) */
      $primary-green: var(--primary);
      $secondary-green: var(--primary-hover);
      $light-green: var(--primary-light);
      $success-color: var(--success);
      $surface-color: var(--surface);
      $bg-color: var(--background);
      $border-color: var(--border);
      $text-main: var(--text-primary);
      $text-muted: var(--text-secondary);

      .chatbot-container {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 1000;
        font-family: 'Inter', Roboto, sans-serif;
      }

      /* FAB button styling */
      .chatbot-fab {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: $primary-green;
        border: none;
        color: var(--text-inverse);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 14px rgba(46, 125, 50, 0.4);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;

        mat-icon {
          font-size: 28px;
          width: 28px;
          height: 28px;
        }

        &:hover {
          transform: scale(1.05) translateY(-2px);
          box-shadow: 0 6px 20px rgba(46, 125, 50, 0.5);
          background: $secondary-green;
        }

        &.hide {
          opacity: 0;
          pointer-events: none;
          transform: scale(0.5);
        }
      }

      /* Modal Panel styling */
      .chatbot-panel {
        position: absolute;
        bottom: 0;
        right: 0;
        width: 400px;
        height: 600px;
        max-height: calc(100vh - 48px);
        max-width: calc(100vw - 48px);
        background: $bg-color;
        border-radius: 16px;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        opacity: 0;
        pointer-events: none;
        transform: scale(0.95) translateY(10px);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        transform-origin: bottom right;

        &.open {
          opacity: 1;
          pointer-events: auto;
          transform: scale(1) translateY(0);
        }
      }

      /* Header */
      .panel-header {
        padding: 16px 20px;
        background: $surface-color;
        border-bottom: 1px solid $border-color;
        display: flex;
        justify-content: space-between;
        align-items: center;

        .header-title {
          display: flex;
          align-items: center;
          gap: 12px;
          .logo-icon {
            color: $surface-color;
            background: $primary-green;
            width: 36px;
            height: 36px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            mat-icon {
              font-size: 22px;
              width: 22px;
              height: 22px;
            }
          }
          .title-text {
            display: flex;
            flex-direction: column;
            h4 {
              margin: 0;
              font-size: 15px;
              font-weight: 600;
              color: $text-main;
            }
            .status {
              font-size: 12px;
              color: $text-muted;
              display: flex;
              align-items: center;
              gap: 6px;
              .status-dot {
                width: 8px;
                height: 8px;
                background-color: $success-color;
                border-radius: 50%;
                display: inline-block;
              }
            }
          }
        }

        .btn-close {
          background: none;
          border: none;
          color: $text-muted;
          cursor: pointer;
          padding: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition:
            background 0.2s,
            color 0.2s;
          &:hover {
            background: $light-green;
            color: $primary-green;
          }
          mat-icon {
            font-size: 20px;
            width: 20px;
            height: 20px;
          }
        }
      }

      /* Messages List */
      .messages-list {
        flex: 1;
        padding: 20px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 16px;
        scroll-behavior: smooth;

        /* Scrollbar */
        &::-webkit-scrollbar {
          width: 6px;
        }
        &::-webkit-scrollbar-track {
          background: transparent;
        }
        &::-webkit-scrollbar-thumb {
          background-color: rgba(0, 0, 0, 0.1);
          border-radius: 10px;
        }
        &::-webkit-scrollbar-thumb:hover {
          background-color: rgba(0, 0, 0, 0.2);
        }
      }

      .message-bubble-wrapper {
        display: flex;
        flex-direction: column;
        max-width: 85%;
        animation: messageSlideIn 0.25s ease-out forwards;
        opacity: 0;
        transform: translateY(10px);

        &.user {
          align-self: flex-end;
          align-items: flex-end;
        }

        &.bot {
          align-self: flex-start;
          align-items: flex-start;
        }
      }

      @keyframes messageSlideIn {
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .message-bubble {
        padding: 12px 16px;
        border-radius: 16px;
        font-size: 14px;
        line-height: 1.5;
        position: relative;
        word-wrap: break-word;

        &.user {
          background: $primary-green;
          color: var(--text-inverse);
          border-bottom-right-radius: 4px;
          box-shadow: 0 2px 5px rgba(46, 125, 50, 0.2);

          p {
            margin: 0;
            white-space: pre-wrap;
          }
          .time {
            color: rgba(255, 255, 255, 0.7);
          }
        }

        &.bot {
          background: $surface-color;
          color: $text-main;
          border: 1px solid $border-color;
          border-left: 4px solid $primary-green;
          border-bottom-left-radius: 4px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);

          .time {
            color: $text-muted;
          }
        }

        .time {
          display: block;
          font-size: 10px;
          margin-top: 6px;
          text-align: right;
        }
      }

      .msg-actions {
        display: flex;
        gap: 4px;
        margin-top: 4px;
        margin-left: 8px;

        button {
          background: none;
          border: none;
          color: $text-muted;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          transition:
            background 0.2s,
            color 0.2s;

          &:hover {
            background: $light-green;
            color: $primary-green;
          }

          mat-icon {
            font-size: 16px;
            width: 16px;
            height: 16px;
          }
        }
      }

      /* Input Box */
      .input-box {
        padding: 16px 20px;
        background: $surface-color;
        border-top: 1px solid $border-color;
        display: flex;
        gap: 12px;
        align-items: flex-end;

        .input-wrapper {
          flex: 1;
          position: relative;
          background: $bg-color;
          border: 1px solid $border-color;
          border-radius: 24px;
          transition:
            border-color 0.2s,
            box-shadow 0.2s;

          &:focus-within {
            border-color: $secondary-green;
            box-shadow: 0 0 0 2px $light-green;
          }

          textarea {
            width: 100%;
            border: none;
            background: transparent;
            padding: 12px 16px;
            color: $text-main;
            font-size: 14px;
            font-family: inherit;
            resize: none;
            max-height: 120px;
            outline: none;
            line-height: 1.4;
            box-sizing: border-box;

            &::placeholder {
              color: $text-muted;
            }

            &::-webkit-scrollbar {
              width: 4px;
            }
            &::-webkit-scrollbar-thumb {
              background-color: rgba(0, 0, 0, 0.1);
              border-radius: 10px;
            }
          }

          .char-count {
            position: absolute;
            bottom: 4px;
            right: 12px;
            font-size: 10px;
            color: $text-muted;
            pointer-events: none;
          }
        }

        /* Explicit Light Theme Overrides */
        :host-context(html:not(.theme-dark)) .input-wrapper {
          background: #ffffff;
          border-color: #dde8dd;

          &:focus-within {
            border-color: #2e7d32;
            box-shadow: 0 0 0 2px rgba(46, 125, 50, 0.15);
          }

          textarea {
            color: #1b1b1b !important;
            caret-color: #1b1b1b;

            &::placeholder {
              color: #6b7280 !important;
            }
          }
        }

        /* Explicit Dark Theme Overrides */
        :host-context(html.theme-dark) .input-wrapper {
          textarea {
            color: #ffffff !important;
            caret-color: #4caf50 !important;

            &::placeholder {
              color: #9e9e9e !important;
            }
          }
        }

        .btn-send {
          background: $primary-green;
          border: none;
          color: var(--text-inverse);
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          flex-shrink: 0;

          &:hover:not(:disabled) {
            background: $secondary-green;
            transform: translateY(-1px);
          }
          &:disabled {
            background: $border-color;
            color: $text-muted;
            cursor: not-allowed;
            transform: none;
          }
          mat-icon {
            font-size: 20px;
            width: 20px;
            height: 20px;
          }
        }
      }

      /* Typing Indicator */
      .typing-bubble {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 12px 16px !important;

        .typing-text {
          font-size: 13px;
          color: $text-muted;
          margin-right: 4px;
        }

        .dot {
          width: 4px;
          height: 4px;
          background: $text-muted;
          border-radius: 50%;
          animation: typingDot 1.4s infinite ease-in-out both;
          &:nth-child(2) {
            animation-delay: 0.2s;
          }
          &:nth-child(3) {
            animation-delay: 0.4s;
          }
          &:nth-child(4) {
            animation-delay: 0.6s;
          }
        }
      }

      @keyframes typingDot {
        0%,
        80%,
        100% {
          transform: scale(0);
          opacity: 0.5;
        }
        40% {
          transform: scale(1);
          opacity: 1;
        }
      }

      .spinner {
        animation: spin 1s linear infinite;
      }
      @keyframes spin {
        100% {
          transform: rotate(360deg);
        }
      }

      /* Markdown styling inside bot messages */
      ::ng-deep .bot-msg-content {
        p {
          margin: 0 0 8px 0;
          &:last-child {
            margin-bottom: 0;
          }
        }
        pre {
          background: rgba(0, 0, 0, 0.05);
          padding: 8px;
          border-radius: 8px;
          overflow-x: auto;
          font-size: 12px;
        }
        code {
          background: rgba(0, 0, 0, 0.05);
          padding: 2px 4px;
          border-radius: 4px;
          font-size: 12px;
          font-family: monospace;
        }
        pre code {
          background: transparent;
          padding: 0;
        }
        ul,
        ol {
          margin: 8px 0;
          padding-left: 20px;
        }
        li {
          margin-bottom: 4px;
        }
        a {
          color: $primary-green;
          text-decoration: none;
          &:hover {
            text-decoration: underline;
          }
        }
        table {
          border-collapse: collapse;
          width: 100%;
          margin: 8px 0;
        }
        th,
        td {
          border: 1px solid $border-color;
          padding: 6px 8px;
          text-align: left;
        }
        th {
          background: $light-green;
          font-weight: 600;
        }
        blockquote {
          border-left: 3px solid $border-color;
          margin: 8px 0;
          padding-left: 12px;
          color: $text-muted;
        }
      }
    `,
  ],
})
export class ChatbotWidgetComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly aiChatService = inject(AIChatService);
  private readonly authService = inject(AuthService);

  @ViewChild('scrollContainer') private readonly scrollContainer!: ElementRef<HTMLDivElement>;

  isOpen = signal<boolean>(false);
  typing = signal<boolean>(false);
  newMessage = '';

  private mutationObserver?: MutationObserver;
  private historySub?: Subscription;

  conversationId = signal<string | undefined>(undefined);
  messages = signal<ChatMessage[]>([]);

  private getInitialText(): string {
    const role = this.authService.userRole();

    if (role === 'admin') {
      return 'Hello! I am the CivicPulse Admin Copilot. I can explain dashboard analytics, charts, ledger actions, or details of any incident ticket. Paste a ticket ID to query its resolution roadmap.';
    }

    if (role === 'officer') {
      return 'Hello! I am the internal officer assistant. I can summarize complaints and suggest workflow steps. Paste a complaint ID to get started.';
    }

    return 'Hello! I am your CivicPulse AI Assistant. I can help guide you through submitting issues, tracking your incident folder, or retrieving department directories. How can I help you today?';
  }

  ngOnInit(): void {
    this.messages.set([
      {
        sender: 'bot',
        text: this.getInitialText(),
        timestamp: new Date().toISOString(),
      },
    ]);

    this.historySub = this.aiChatService.historyCleared$.subscribe(() => {
      this.conversationId.set(undefined);
      this.messages.set([
        {
          sender: 'bot',
          text: this.getInitialText(),
          timestamp: new Date().toISOString(),
        },
      ]);
    });

    this.loadHistory();
  }

  ngAfterViewInit(): void {
    // Watch for DOM mutations in the scroll container to auto-scroll gracefully
    if (this.scrollContainer) {
      this.mutationObserver = new MutationObserver((mutations) => {
        // Check if nodes were added
        const hasNewNodes = mutations.some((m) => m.addedNodes.length > 0);
        if (hasNewNodes) {
          this.scrollToBottom();
        }
      });

      this.mutationObserver.observe(this.scrollContainer.nativeElement, {
        childList: true,
        subtree: true,
      });
    }
  }

  ngOnDestroy(): void {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }
    if (this.historySub) {
      this.historySub.unsubscribe();
    }
  }

  toggleChat(): void {
    this.isOpen.update((v) => !v);
    if (this.isOpen()) {
      setTimeout(() => this.scrollToBottom(), 100);
    }
  }

  loadHistory(): void {
    this.aiChatService.getConversations().subscribe({
      next: (res) => {
        if (res.success && res.data && res.data.conversations.length > 0) {
          const latest = res.data.conversations[0];
          this.conversationId.set(latest._id);
          if (latest.messages && latest.messages.length > 0) {
            this.messages.set(latest.messages);
            setTimeout(() => this.scrollToBottom(), 100);
          }
        }
      },
    });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  autoGrow(element: HTMLTextAreaElement): void {
    element.style.height = 'auto';
    element.style.height = Math.min(element.scrollHeight, 120) + 'px';
  }

  sendMessage(): void {
    if (!this.newMessage.trim() || this.typing() || this.newMessage.length > 500) return;

    const userText = this.newMessage;
    this.newMessage = '';

    // Reset textarea height
    const textarea = document.querySelector('.input-wrapper textarea') as HTMLTextAreaElement;
    if (textarea) textarea.style.height = 'auto';

    this.messages.update((arr) => [
      ...arr,
      {
        sender: 'user',
        text: userText,
        timestamp: new Date().toISOString(),
      },
    ]);

    this.typing.set(true);

    this.aiChatService.sendMessage(userText, this.conversationId()).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.conversationId.set(res.data.conversation._id);
          this.messages.set(res.data.conversation.messages);
        }
        this.typing.set(false);
      },
      error: () => {
        this.messages.update((arr) => [
          ...arr,
          {
            sender: 'bot',
            text: "Sorry, I'm having trouble connecting to the CivicPulse service right now. Please try again in a moment.",
            timestamp: new Date().toISOString(),
          },
        ]);
        this.typing.set(false);
      },
    });
  }

  copyText(text: string): void {
    navigator.clipboard.writeText(text);
  }

  private scrollToBottom(): void {
    try {
      const el = this.scrollContainer.nativeElement;
      // Only auto scroll if we are already near the bottom (prevents scroll jumping when reading history)
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
      if (isNearBottom || this.messages().length <= 2) {
        el.scrollTop = el.scrollHeight;
      }
    } catch {}
  }
}
