import { describe, it, expect } from 'vitest';
import { parsePythonDict, extractScreen, extractAllProperties } from '../../parsers/uxcam-property-parser.js';

describe('UXCam Property Column Parser', () => {
  // The property column contains Python dict literals as strings.
  // Must be parsed in TypeScript without ast.literal_eval.

  describe('parsePythonDict', () => {
    it('parses a simple Python dict with single-quoted strings', () => {
      const raw = "{'screen_name': 'app_open'}";
      const result = parsePythonDict(raw);
      expect(result).toEqual({ screen_name: 'app_open' });
    });

    it('parses a dict with multiple keys', () => {
      const raw = "{'flow_type': 'chat', 'screen_name': 'onboard_selector', 'screen_class': 'OnboardSelector'}";
      const result = parsePythonDict(raw);
      expect(result).toEqual({
        flow_type: 'chat',
        screen_name: 'onboard_selector',
        screen_class: 'OnboardSelector',
      });
    });

    it('parses subscription event properties', () => {
      const raw = "{'plan': 'monthly', 'price': '9.99', 'from_page': 'chat'}";
      const result = parsePythonDict(raw);
      expect(result).toEqual({
        plan: 'monthly',
        price: '9.99',
        from_page: 'chat',
      });
    });

    it('handles Python True/False/None values', () => {
      const raw = "{'is_premium': True, 'has_trial': False, 'coupon': None}";
      const result = parsePythonDict(raw);
      expect(result).toEqual({
        is_premium: true,
        has_trial: false,
        coupon: null,
      });
    });

    it('handles numeric values', () => {
      const raw = "{'session_count': 5, 'duration': 12.5}";
      const result = parsePythonDict(raw);
      expect(result).toEqual({
        session_count: 5,
        duration: 12.5,
      });
    });

    it('handles empty dict', () => {
      const raw = '{}';
      const result = parsePythonDict(raw);
      expect(result).toEqual({});
    });

    it('handles values with special characters in strings', () => {
      const raw = "{'screen_name': 'user\\'s_profile', 'path': '/home/chat'}";
      const result = parsePythonDict(raw);
      expect(result.screen_name).toBeDefined();
      expect(result.path).toBe('/home/chat');
    });

    it('handles double-quoted strings within Python dict', () => {
      const raw = '{"screen_name": "app_open", "screen_class": "AppOpen"}';
      const result = parsePythonDict(raw);
      expect(result).toEqual({
        screen_name: 'app_open',
        screen_class: 'AppOpen',
      });
    });

    it('returns empty object for malformed input', () => {
      expect(parsePythonDict('not a dict')).toEqual({});
      expect(parsePythonDict('')).toEqual({});
      expect(parsePythonDict('null')).toEqual({});
    });

    it('handles nested dict (should flatten or return as-is)', () => {
      const raw = "{'screen_name': 'chat', 'metadata': {'version': '1.0'}}";
      const result = parsePythonDict(raw);
      expect(result.screen_name).toBe('chat');
      // metadata can be a nested object or stringified — implementation decides
      expect(result.metadata).toBeDefined();
    });

    it('handles modal event properties', () => {
      const raw = "{'chatbot': 'Hazel', 'modal_type': 'trial_limit'}";
      const result = parsePythonDict(raw);
      expect(result).toEqual({
        chatbot: 'Hazel',
        modal_type: 'trial_limit',
      });
    });

    it('handles property with alias containing unicode', () => {
      const raw = "{'alias': 'José García', 'subscription_status': 'trial'}";
      const result = parsePythonDict(raw);
      expect(result.alias).toBe('José García');
      expect(result.subscription_status).toBe('trial');
    });
  });

  describe('extractScreen', () => {
    it('extracts screen_name from a property string', () => {
      expect(extractScreen("{'screen_name': 'chat', 'screen_class': 'Chat'}")).toBe('chat');
    });

    it('returns "unknown" when screen_name is not present', () => {
      expect(extractScreen("{'flow_type': 'signup'}")).toBe('unknown');
    });

    it('returns "unknown" for malformed property string', () => {
      expect(extractScreen('garbage')).toBe('unknown');
      expect(extractScreen('')).toBe('unknown');
    });

    it('extracts screen from subscription events', () => {
      expect(extractScreen("{'screen_name': 'trial_start', 'screen_class': 'TrialStart'}")).toBe('trial_start');
    });
  });

  describe('extractAllProperties', () => {
    it('extracts all standard fields from an event property', () => {
      const raw = "{'screen_name': 'chat', 'screen_class': 'Chat', 'from_page': 'home', 'flow_type': 'main', 'plan': 'monthly', 'price': '9.99'}";
      const result = extractAllProperties(raw);
      expect(result.screen_name).toBe('chat');
      expect(result.screen_class).toBe('Chat');
      expect(result.from_page).toBe('home');
      expect(result.flow_type).toBe('main');
      expect(result.plan).toBe('monthly');
      expect(result.price).toBe('9.99');
    });
  });
});
