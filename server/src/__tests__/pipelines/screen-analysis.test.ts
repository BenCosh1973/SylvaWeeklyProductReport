import { describe, it, expect } from 'vitest';
import { analyseSubscriptionScreens } from '../../pipelines/screen-analysis.js';
import type { ScreenRow } from '../../pipelines/screen-analysis.js';

describe('Screen-Level Analysis', () => {
  const sampleScreens: ScreenRow[] = [
    { screen_name: '/subscribe', totalsession: 9, totalbounce: 0, totalengagementtimemedian: 2.4, totalrage: 0, totalexit: 3, totalopen: 9 },
    { screen_name: '/chat', totalsession: 120, totalbounce: 62, totalengagementtimemedian: 45.2, totalrage: 5, totalexit: 30, totalopen: 120 },
    { screen_name: '/home', totalsession: 200, totalbounce: 40, totalengagementtimemedian: 12.0, totalrage: 2, totalexit: 50, totalopen: 200 },
    { screen_name: '/settings', totalsession: 25, totalbounce: 5, totalengagementtimemedian: 8.0, totalrage: 3, totalexit: 10, totalopen: 25 },
    { screen_name: '/login', totalsession: 150, totalbounce: 20, totalengagementtimemedian: 6.5, totalrage: 1, totalexit: 15, totalopen: 150 },
    { screen_name: '/trial-start', totalsession: 30, totalbounce: 5, totalengagementtimemedian: 15.0, totalrage: 0, totalexit: 8, totalopen: 30 },
  ];

  it('returns metrics for subscription-related screens', () => {
    const result = analyseSubscriptionScreens(sampleScreens);
    const screenNames = result.map(r => r.screenName);

    expect(screenNames).toContain('/subscribe');
    expect(screenNames).toContain('/chat');
    expect(screenNames).toContain('/settings');
    expect(screenNames).toContain('/trial-start');
  });

  it('calculates bounce rate correctly', () => {
    const result = analyseSubscriptionScreens(sampleScreens);
    const chat = result.find(r => r.screenName === '/chat');
    // 62/120 = 51.67%
    expect(chat?.bounceRate).toBeCloseTo(51.67, 0);
  });

  it('reports zero bounce rate for /subscribe', () => {
    const result = analyseSubscriptionScreens(sampleScreens);
    const subscribe = result.find(r => r.screenName === '/subscribe');
    expect(subscribe?.bounceRate).toBe(0);
  });

  it('includes engagement time median', () => {
    const result = analyseSubscriptionScreens(sampleScreens);
    const subscribe = result.find(r => r.screenName === '/subscribe');
    expect(subscribe?.medianEngagementTime).toBeCloseTo(2.4, 1);
  });

  it('includes rage gesture count', () => {
    const result = analyseSubscriptionScreens(sampleScreens);
    const settings = result.find(r => r.screenName === '/settings');
    expect(settings?.totalRage).toBe(3);
  });

  it('handles empty screen data', () => {
    const result = analyseSubscriptionScreens([]);
    expect(result).toEqual([]);
  });

  it('handles screen names without leading slash (case-insensitive matching)', () => {
    const screens: ScreenRow[] = [
      { screen_name: 'subscribe', totalsession: 5, totalbounce: 1, totalengagementtimemedian: 3.0, totalrage: 0, totalexit: 2, totalopen: 5 },
    ];
    const result = analyseSubscriptionScreens(screens);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });
});
