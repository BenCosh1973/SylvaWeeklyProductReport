import { describe, it, expect } from 'vitest';
import { classifyByHeaders, classifyFile, selectBestFile } from '../../parsers/csv-classifier.js';
import type { ClassifiedFile } from '../../types.js';

describe('CSV Auto-Classifier', () => {
  // === AC-DS-1: Auto-classifier reads CSV headers and matches against known column signatures ===

  describe('classifyByHeaders', () => {
    it('identifies UXCam event-level data by required columns', () => {
      const headers = ['sessionid', 'eventname', 'property', 'trackedon', 'uxcamuserid', 'screen_name'];
      expect(classifyByHeaders(headers)).toBe('uxcam_events');
    });

    it('identifies UXCam event-level data with extra columns (previous period format)', () => {
      const headers = [
        'sessionid', 'eventname', 'property', 'trackedon', 'uxcamuserid',
        'screen_name', 'Browser', 'Browser version', 'Device type', 'Device OS name',
      ];
      expect(classifyByHeaders(headers)).toBe('uxcam_events');
    });

    it('identifies UXCam user-level data', () => {
      const headers = [
        'uxcamuserid', 'country', 'totalsession', 'totalsessiontime',
        'u__subscriptionstatus', 'devicemodel', 'platform',
      ];
      expect(classifyByHeaders(headers)).toBe('uxcam_users');
    });

    it('identifies UXCam user-level data with underscore variant column name', () => {
      const headers = [
        'uxcamuserid', 'country', 'totalsession', 'totalsessiontime',
        'u__subscription_status', 'devicemodel', 'platform',
      ];
      expect(classifyByHeaders(headers)).toBe('uxcam_users');
    });

    it('identifies UXCam session-level data', () => {
      const headers = [
        'sessionid', 'uxcamuserid', 'totalsessiontime', 'ragegesturecount',
        'unresponsivegesturecount', 'locationcountry', 'recordedon',
      ];
      expect(classifyByHeaders(headers)).toBe('uxcam_sessions');
    });

    it('identifies UXCam screen-level data', () => {
      const headers = [
        'totalbounce', 'totalengagementtimemedian', 'totalsession', 'screen_name',
        'totalrage', 'totalopen', 'totalexit',
      ];
      expect(classifyByHeaders(headers)).toBe('uxcam_screens');
    });

    it('identifies RevenueCat conversion file by triple-column pattern', () => {
      // Triple columns: Total, Total, Total, Sylva, Sylva, Sylva, Rowan, Rowan, Rowan, Hazel, Hazel, Hazel
      const headers = [
        'Project', 'Total', 'Total', 'Total', 'Sylva', 'Sylva', 'Sylva',
        'Rowan', 'Rowan', 'Rowan', 'Hazel', 'Hazel', 'Hazel',
      ];
      expect(classifyByHeaders(headers)).toBe('revenuecat_conversion');
    });

    it('identifies RevenueCat retention file', () => {
      const headers = ['Cohort', 'Subscriptions', 'Month 1', 'Month 2', 'Month 3', 'Month 4'];
      expect(classifyByHeaders(headers)).toBe('revenuecat_retention');
    });

    it('identifies RevenueCat active subs (simple format with integer values)', () => {
      // This requires sample rows to distinguish from MRR
      const headers = ['Project', 'Total', 'Sylva', 'Rowan', 'Hazel'];
      // When sample rows have integer values, it's active subs
      // When sample rows have decimal monetary values, it's MRR
      // Without sample rows, returns a generic revenuecat type
      const result = classifyByHeaders(headers);
      expect(['revenuecat_active_subs', 'revenuecat_mrr', 'revenuecat_new_customers']).toContain(result);
    });

    it('identifies Chat Digest data', () => {
      const headers = [
        'User ID', 'Timestamp', 'Subscription status', 'CSAT', 'Message Count',
        'Duration (min)', 'Topic', 'Emotions Before', 'Emotions After',
        'PSS10 Before', 'PSS10 After',
      ];
      expect(classifyByHeaders(headers)).toBe('chat_digests');
    });

    it('identifies ICP Challenges data', () => {
      const headers = ['ID', 'Platform', 'Timestamp', 'Multiple choice', 'Free text'];
      expect(classifyByHeaders(headers)).toBe('icp_challenges');
    });

    it('identifies Adjust daily retention (D0-D30)', () => {
      const headers = [
        'day', 'installs', 'retention_rate_d0', 'retention_rate_d1',
        'retention_rate_d2', 'retention_rate_d3', 'retention_rate_d7',
      ];
      expect(classifyByHeaders(headers)).toBe('adjust_daily');
    });

    it('identifies Adjust weekly retention', () => {
      const headers = ['week', 'installs', 'retention_rate_w1', 'retention_rate_w2', 'retention_rate_w3', 'retention_rate_w4'];
      expect(classifyByHeaders(headers)).toBe('adjust_weekly');
    });

    it('identifies Adjust monthly retention', () => {
      const headers = ['month', 'installs', 'retention_rate_m1'];
      expect(classifyByHeaders(headers)).toBe('adjust_monthly');
    });

    it('identifies Adjust country report', () => {
      const headers = ['month', 'country', 'installs', 'cost', 'all_revenue', 'daus'];
      expect(classifyByHeaders(headers)).toBe('adjust_country');
    });

    it('identifies trial duration CSV', () => {
      const headers = ['user_id', 'trial_length_days'];
      expect(classifyByHeaders(headers)).toBe('trial_durations');
    });

    it('identifies UXCam session list (human-readable export)', () => {
      const headers = [
        'User', 'Session #', 'Session duration', 'AI summary',
        'Relevance score', 'Has rage taps', 'Has crash',
      ];
      expect(classifyByHeaders(headers)).toBe('uxcam_session_list');
    });

    it('returns unknown for unrecognized headers', () => {
      const headers = ['foo', 'bar', 'baz'];
      expect(classifyByHeaders(headers)).toBe('unknown');
    });

    it('is case-insensitive when matching headers', () => {
      const headers = ['SessionID', 'EventName', 'Property', 'TrackedOn', 'UxcamUserID', 'Screen_Name'];
      expect(classifyByHeaders(headers)).toBe('uxcam_events');
    });

    it('handles headers with extra whitespace', () => {
      const headers = [' sessionid ', 'eventname', ' property', 'trackedon ', 'uxcamuserid', 'screen_name'];
      expect(classifyByHeaders(headers)).toBe('uxcam_events');
    });
  });

  describe('classifyFile', () => {
    it('returns a ClassifiedFile object with all fields populated', () => {
      const result = classifyFile(
        'events_export.csv',
        ['sessionid', 'eventname', 'property', 'trackedon', 'uxcamuserid', 'screen_name'],
        2361
      );
      expect(result).toMatchObject({
        filename: 'events_export.csv',
        sourceType: 'uxcam_events',
        rowCount: 2361,
        headers: expect.arrayContaining(['sessionid', 'eventname']),
      });
    });

    it('distinguishes RevenueCat MRR from active subs using sample rows', () => {
      const headers = ['Project', 'Total', 'Sylva', 'Rowan', 'Hazel'];
      const mrrSample = [['2026-03-01', '90.24', '80.24', '5.00', '5.00']];
      const subsSample = [['2026-03-01', '10', '8', '1', '1']];

      const mrrResult = classifyFile('mrr.csv', headers, 91, mrrSample);
      const subsResult = classifyFile('subs.csv', headers, 91, subsSample);

      expect(mrrResult.sourceType).toBe('revenuecat_mrr');
      expect(subsResult.sourceType).toBe('revenuecat_active_subs');
    });

    // AC-UP-3: Unrecognised files are flagged with a warning, not silently dropped
    it('marks unrecognized files as unknown', () => {
      const result = classifyFile('random.csv', ['a', 'b', 'c'], 10);
      expect(result.sourceType).toBe('unknown');
    });
  });

  describe('selectBestFile (deduplication)', () => {
    // AC-DS-2: Duplicate files (_1 suffixes) detected; highest row-count Chat Digest auto-selected
    it('selects the Chat Digest file with the highest row count', () => {
      const files: ClassifiedFile[] = [
        { filename: 'SM_Chat_Digest.csv', sourceType: 'chat_digests', rowCount: 674, dateRange: null, headers: [] },
        { filename: 'SM_Chat_Digest_1.csv', sourceType: 'chat_digests', rowCount: 686, dateRange: null, headers: [] },
        { filename: 'SM_Chat_Digest_2.csv', sourceType: 'chat_digests', rowCount: 832, dateRange: null, headers: [] },
      ];
      const best = selectBestFile(files);
      expect(best.filename).toBe('SM_Chat_Digest_2.csv');
      expect(best.rowCount).toBe(832);
    });

    it('selects the ICP Challenges file with the highest row count', () => {
      const files: ClassifiedFile[] = [
        { filename: 'ICP_challenges_1.csv', sourceType: 'icp_challenges', rowCount: 414, dateRange: null, headers: [] },
        { filename: 'ICP_challenges_3.csv', sourceType: 'icp_challenges', rowCount: 540, dateRange: null, headers: [] },
      ];
      const best = selectBestFile(files);
      expect(best.rowCount).toBe(540);
    });

    it('returns the only file when there is no duplicate', () => {
      const files: ClassifiedFile[] = [
        { filename: 'events.csv', sourceType: 'uxcam_events', rowCount: 2361, dateRange: null, headers: [] },
      ];
      expect(selectBestFile(files)).toBe(files[0]);
    });
  });
});
