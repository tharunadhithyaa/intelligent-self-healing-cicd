import { describe, it, expect } from 'vitest';
import { ChartComponent } from './chart.component';

describe('ChartComponent', () => {
  it('should initialize with default values', () => {
    const chart = new ChartComponent();
    expect(chart.type).toBe('bar');
    expect(chart.gradientId).toBeDefined();
    expect(chart.bars()).toEqual([]);
    expect(chart.points()).toEqual([]);
  });

  it('should compute bars correctly when data is provided', () => {
    const chart = new ChartComponent();
    chart.data = [
      { label: 'Jan', value: 10 },
      { label: 'Feb', value: 20 },
    ];
    const bars = chart.bars();
    expect(bars.length).toBe(2);
    expect(bars[0].label).toBe('Jan');
    expect(bars[0].value).toBe(10);
  });

  it('should compute gauge offset correctly', () => {
    const chart = new ChartComponent();
    chart.value = 50;
    const offset = chart.gaugeOffset();
    expect(offset).toBeLessThan(251.2);
  });
});
