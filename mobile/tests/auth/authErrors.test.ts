// Tests for the auth error classifier (issue #64).
// A field-facing app must never surface raw SDK strings like
// "JSON Parse error: Unexpected character e".

import { classifyAuthError, authErrorMessage, AUTH_MESSAGES } from '../../src/supabase/authErrors';

describe('classifyAuthError', () => {
  describe('account_disabled (baja reversible desde la web)', () => {
    it('mapea el código user_banned de GoTrue', () => {
      expect(classifyAuthError({ status: 400, code: 'user_banned', message: 'User is banned' })).toBe('account_disabled');
    });

    it('mapea el mensaje "banned" sin código', () => {
      expect(classifyAuthError({ message: 'User is banned' })).toBe('account_disabled');
    });

    it('tiene mensaje en español para el usuario', () => {
      expect(authErrorMessage({ code: 'user_banned' })).toBe('Tu cuenta fue desactivada. Contactá a un administrador.');
    });
  });

  describe('connectivity (backend down / unreachable)', () => {
    it('maps the non-JSON parse error from a down backend', () => {
      expect(classifyAuthError({ message: 'JSON Parse error: Unexpected character e' })).toBe('connectivity');
    });

    it('maps an "Unexpected token" parse error', () => {
      expect(classifyAuthError({ message: 'Unexpected token < in JSON at position 0' })).toBe('connectivity');
    });

    it('maps a network request failure', () => {
      expect(classifyAuthError({ message: 'Network request failed' })).toBe('connectivity');
    });

    it('maps a timeout', () => {
      expect(classifyAuthError({ message: 'timeout' })).toBe('connectivity');
    });

    it('maps a 5xx status', () => {
      expect(classifyAuthError({ status: 503, message: 'Service Unavailable' })).toBe('connectivity');
    });

    it('maps supabase AuthRetryableFetchError by name', () => {
      expect(classifyAuthError({ name: 'AuthRetryableFetchError', message: 'whatever' })).toBe('connectivity');
    });

    it('maps a RN TypeError network failure by name', () => {
      expect(classifyAuthError({ name: 'TypeError', message: 'Failed to fetch' })).toBe('connectivity');
    });
  });

  describe('invalid_credentials (real wrong email/password)', () => {
    it('maps the supabase invalid_credentials code', () => {
      expect(classifyAuthError({ status: 400, code: 'invalid_credentials', message: 'Invalid login credentials' })).toBe('invalid_credentials');
    });

    it('maps by the "Invalid login credentials" message', () => {
      expect(classifyAuthError({ message: 'Invalid login credentials' })).toBe('invalid_credentials');
    });

    it('prefers invalid_credentials over connectivity when both could match', () => {
      // A 400 with the credentials code must not be read as a server error.
      expect(classifyAuthError({ status: 400, code: 'invalid_credentials' })).toBe('invalid_credentials');
    });
  });

  describe('unknown', () => {
    it('maps null/undefined', () => {
      expect(classifyAuthError(null)).toBe('unknown');
      expect(classifyAuthError(undefined)).toBe('unknown');
    });

    it('maps an unrecognized error', () => {
      expect(classifyAuthError({ message: 'something weird happened' })).toBe('unknown');
    });
  });
});

describe('authErrorMessage', () => {
  it('never returns the raw SDK message for a parse error', () => {
    const raw = 'JSON Parse error: Unexpected character e';
    const message = authErrorMessage({ message: raw });
    expect(message).toBe(AUTH_MESSAGES.connectivity);
    expect(message).not.toContain('JSON Parse');
  });

  it('returns the credentials message for invalid credentials', () => {
    expect(authErrorMessage({ code: 'invalid_credentials' })).toBe(AUTH_MESSAGES.invalid_credentials);
  });

  it('returns the unknown message as a safe default', () => {
    expect(authErrorMessage({ message: 'mystery' })).toBe(AUTH_MESSAGES.unknown);
  });
});
