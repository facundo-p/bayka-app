// Tests for useNetStatus hook
// Validates reactive network status via NetInfo subscription

let capturedListener: ((state: any) => void) | null = null;
const mockUnsubscribe = jest.fn();

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn((listener: (state: any) => void) => {
    capturedListener = listener;
    return mockUnsubscribe;
  }),
}));

import { renderHook, act } from '@testing-library/react-native';
import { useNetStatus } from '../../src/hooks/useNetStatus';

describe('useNetStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedListener = null;
  });

  it('returns isOnline=false initially (default safe state)', () => {
    const { result } = renderHook(() => useNetStatus());
    expect(result.current.isOnline).toBe(false);
  });

  it('returns isOnline=true when NetInfo fires with isConnected=true and isInternetReachable=true', () => {
    const { result } = renderHook(() => useNetStatus());
    act(() => {
      capturedListener!({ isConnected: true, isInternetReachable: true });
    });
    expect(result.current.isOnline).toBe(true);
  });

  it('returns isOnline=false when NetInfo fires with isConnected=false', () => {
    const { result } = renderHook(() => useNetStatus());
    act(() => {
      capturedListener!({ isConnected: false, isInternetReachable: false });
    });
    expect(result.current.isOnline).toBe(false);
  });

  it('returns isOnline=false when NetInfo fires with isConnected=null', () => {
    const { result } = renderHook(() => useNetStatus());
    act(() => {
      capturedListener!({ isConnected: null, isInternetReachable: null });
    });
    expect(result.current.isOnline).toBe(false);
  });

  it('returns isOnline=true when isConnected=true and isInternetReachable=null (treat null as reachable)', () => {
    const { result } = renderHook(() => useNetStatus());
    act(() => {
      capturedListener!({ isConnected: true, isInternetReachable: null });
    });
    expect(result.current.isOnline).toBe(true);
  });

  it('cleans up subscription on unmount', () => {
    const { unmount } = renderHook(() => useNetStatus());
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
