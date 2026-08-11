import { Component, Input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ChartDataPoint {
  label: string;
  value: number;
}

@Component({
  selector: 'app-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chart-wrapper" [style.height.px]="height">
      @if (type === 'bar') {
        <div class="svg-container">
          <svg viewBox="0 0 500 200" preserveAspectRatio="none" class="chart-svg">
            <!-- Grid Lines -->
            <line
              x1="0"
              y1="50"
              x2="500"
              y2="50"
              stroke="rgba(255,255,255,0.07)"
              stroke-width="1"
            ></line>
            <line
              x1="0"
              y1="100"
              x2="500"
              y2="100"
              stroke="rgba(255,255,255,0.07)"
              stroke-width="1"
            ></line>
            <line
              x1="0"
              y1="150"
              x2="500"
              y2="150"
              stroke="rgba(255,255,255,0.07)"
              stroke-width="1"
            ></line>
            <line
              x1="0"
              y1="180"
              x2="500"
              y2="180"
              stroke="rgba(255,255,255,0.15)"
              stroke-width="1.5"
            ></line>

            <!-- Bars -->
            @for (bar of bars(); track bar.label) {
              <rect
                [attr.x]="bar.x"
                [attr.y]="bar.y"
                [attr.width]="bar.width"
                [attr.height]="bar.height"
                [attr.fill]="color"
                rx="4"
                class="bar-rect"
              >
                <title>{{ bar.label }}: {{ bar.value }}</title>
              </rect>
              <text
                [attr.x]="bar.textX"
                [attr.y]="bar.y - 6"
                fill="var(--text-primary)"
                font-size="9"
                font-weight="bold"
                text-anchor="middle"
              >
                {{ bar.value }}
              </text>
              <text
                [attr.x]="bar.textX"
                y="195"
                fill="var(--text-secondary)"
                font-size="9"
                text-anchor="middle"
              >
                {{ bar.shortLabel }}
              </text>
            }
          </svg>
        </div>
      }

      @if (type === 'line') {
        <div class="svg-container">
          <svg viewBox="0 0 500 200" preserveAspectRatio="none" class="chart-svg">
            <defs>
              <linearGradient [id]="gradientId" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" [attr.stop-color]="color" stop-opacity="0.25"></stop>
                <stop offset="100%" [attr.stop-color]="color" stop-opacity="0.0"></stop>
              </linearGradient>
            </defs>

            <!-- Grid Lines -->
            <line
              x1="0"
              y1="50"
              x2="500"
              y2="50"
              stroke="rgba(255,255,255,0.07)"
              stroke-width="1"
            ></line>
            <line
              x1="0"
              y1="100"
              x2="500"
              y2="100"
              stroke="rgba(255,255,255,0.07)"
              stroke-width="1"
            ></line>
            <line
              x1="0"
              y1="150"
              x2="500"
              y2="150"
              stroke="rgba(255,255,255,0.07)"
              stroke-width="1"
            ></line>
            <line
              x1="0"
              y1="180"
              x2="500"
              y2="180"
              stroke="rgba(255,255,255,0.15)"
              stroke-width="1.5"
            ></line>

            <!-- Area Shading -->
            <path
              [attr.d]="areaPath()"
              [attr.fill]="'url(#' + gradientId + ')'"
              class="line-area"
            ></path>

            <!-- Line Path -->
            <path
              [attr.d]="linePath()"
              fill="none"
              [attr.stroke]="color"
              stroke-width="3"
              stroke-linecap="round"
              class="line-stroke"
            ></path>

            <!-- Data Nodes -->
            @for (pt of points(); track pt.label) {
              <circle
                [attr.cx]="pt.x"
                [attr.cy]="pt.y"
                r="5.5"
                fill="var(--surface-card)"
                [attr.stroke]="color"
                stroke-width="3.5"
                class="line-circle"
              >
                <title>{{ pt.label }}: {{ pt.value }}</title>
              </circle>
              <text
                [attr.x]="pt.x"
                [attr.y]="pt.y - 10"
                fill="var(--text-primary)"
                font-size="9"
                font-weight="bold"
                text-anchor="middle"
              >
                {{ pt.value }}
              </text>
              <text
                [attr.x]="pt.x"
                y="195"
                fill="var(--text-secondary)"
                font-size="9"
                text-anchor="middle"
              >
                {{ pt.shortLabel }}
              </text>
            }
          </svg>
        </div>
      }

      @if (type === 'gauge') {
        <div class="gauge-container">
          <svg viewBox="0 0 100 100" class="gauge-svg">
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              stroke-width="8"
            ></circle>
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              [attr.stroke]="color"
              stroke-width="8"
              stroke-linecap="round"
              [attr.stroke-dasharray]="251.2"
              [attr.stroke-dashoffset]="gaugeOffset()"
              transform="rotate(-90 50 50)"
              class="gauge-fill"
            ></circle>
          </svg>
          <div class="gauge-label-box">
            <div class="gauge-num" [style.color]="color">{{ value }}%</div>
            <div class="gauge-lbl">{{ label }}</div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      @use 'styles/variables' as *;

      .chart-wrapper {
        position: relative;
        width: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        background: rgba(255, 255, 255, 0.02);
        border-radius: 12px;
        padding: 16px;
        box-sizing: border-box;
        border: 1px solid rgba(255, 255, 255, 0.05);
        overflow: hidden;
      }

      .svg-container {
        width: 100%;
        height: 100%;
        position: relative;
      }

      .chart-svg {
        width: 100%;
        height: 100%;
        overflow: visible;
      }

      .bar-rect {
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        cursor: pointer;
        &:hover {
          opacity: 0.85;
          transform: translateY(-2px);
        }
      }

      .line-stroke {
        stroke-dasharray: 1000;
        stroke-dashoffset: 1000;
        animation: drawLine 2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      }

      .line-area {
        opacity: 0;
        animation: fadeIn 1s ease-in 1.2s forwards;
      }

      .line-circle {
        cursor: pointer;
        transition: r 0.2s ease;
        &:hover {
          r: 7.5;
        }
      }

      /* Gauge styling */
      .gauge-container {
        position: relative;
        width: 130px;
        height: 130px;
      }

      .gauge-svg {
        width: 100%;
        height: 100%;
      }

      .gauge-fill {
        transition: stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .gauge-label-box {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
        display: flex;
        flex-direction: column;
      }

      .gauge-num {
        font-size: 20px;
        font-weight: 800;
        line-height: 1;
        letter-spacing: -0.5px;
      }

      .gauge-lbl {
        font-size: 10px;
        color: var(--text-secondary);
        margin-top: 4px;
        text-transform: uppercase;
        font-weight: 600;
      }

      @keyframes drawLine {
        to {
          stroke-dashoffset: 0;
        }
      }

      @keyframes fadeIn {
        to {
          opacity: 1;
        }
      }
    `,
  ],
})
export class ChartComponent {
  @Input() type: 'bar' | 'line' | 'gauge' = 'bar';
  @Input() data: ChartDataPoint[] = [];
  @Input() value = 0; // For gauge type
  @Input() label = ''; // For gauge type
  @Input() color = 'var(--primary-color)';
  @Input() height = 220;

  gradientId = `grad_${crypto.randomUUID()}`;

  // Signal wrapper
  dataSignal = computed(() => this.data || []);

  bars = computed(() => {
    const list = this.dataSignal();
    if (list.length === 0) return [];

    const maxVal = Math.max(...list.map((d) => d.value)) || 10;
    const count = list.length;
    const padding = 15;
    const availWidth = 500 - padding * 2;
    const barWidth = Math.min(40, Math.floor(availWidth / count) - 15);
    const spacing = Math.floor((availWidth - barWidth * count) / (count - 1 || 1));

    return list.map((item, idx) => {
      const scaleHeight = Math.max(10, Math.round((item.value / maxVal) * 120));
      const x = padding + idx * (barWidth + spacing);
      const y = 180 - scaleHeight;
      const textX = x + barWidth / 2;
      const shortLabel = item.label.length > 8 ? `${item.label.substring(0, 6)}..` : item.label;

      return {
        label: item.label,
        shortLabel,
        value: item.value,
        x,
        y,
        width: barWidth,
        height: scaleHeight,
        textX,
      };
    });
  });

  points = computed(() => {
    const list = this.dataSignal();
    if (list.length === 0) return [];

    const maxVal = Math.max(...list.map((d) => d.value)) || 10;
    const count = list.length;
    const padding = 30;
    const availWidth = 500 - padding * 2;
    const stepX = count > 1 ? availWidth / (count - 1) : availWidth;

    return list.map((item, idx) => {
      const scaleHeight = Math.round((item.value / maxVal) * 110);
      const x = padding + idx * stepX;
      const y = 160 - scaleHeight;
      const shortLabel = item.label.length > 8 ? `${item.label.substring(0, 6)}..` : item.label;

      return {
        label: item.label,
        shortLabel,
        value: item.value,
        x,
        y,
      };
    });
  });

  linePath = computed(() => {
    const pts = this.points();
    if (pts.length === 0) return '';
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  });

  areaPath = computed(() => {
    const pts = this.points();
    if (pts.length === 0) return '';
    const lastPoint = pts.at(-1);
    if (!lastPoint) return '';
    const line = this.linePath();
    const firstX = pts[0].x;
    const lastX = lastPoint.x;
    return `${line} L ${lastX} 180 L ${firstX} 180 Z`;
  });

  gaugeOffset = computed(() => {
    const val = Math.min(100, Math.max(0, this.value));
    const circumference = 2 * Math.PI * 40; // 251.2
    return circumference - (val / 100) * circumference;
  });
}
