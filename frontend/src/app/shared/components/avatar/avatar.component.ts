import { Component, input, computed } from '@angular/core';

@Component({
  selector: 'app-avatar',
  template: `
    @if (src()) {
      <img
        class="avatar"
        [src]="src()"
        [alt]="alt()"
        [style.width.px]="size()"
        [style.height.px]="size()"
        [style.font-size.px]="size() * 0.4"
      />
    } @else {
      <div
        class="avatar avatar--initials"
        [style.width.px]="size()"
        [style.height.px]="size()"
        [style.font-size.px]="size() * 0.4"
      >
        {{ computedInitials() }}
      </div>
    }
  `,
  styles: [`
    @use 'styles/variables' as *;

    .avatar {
      border-radius: $radius-full;
      object-fit: cover;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      &--initials {
        background: $gradient-primary;
        color: $text-inverse;
        font-weight: $font-weight-semibold;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
    }
  `],
})
export class AvatarComponent {
  readonly src = input<string>('');
  readonly name = input('');
  readonly size = input(40);
  readonly alt = input('User avatar');

  readonly computedInitials = computed(() => {
    const n = this.name();
    if (!n) return '?';
    const parts = n.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`;
    }
    return n.substring(0, 2);
  });
}
