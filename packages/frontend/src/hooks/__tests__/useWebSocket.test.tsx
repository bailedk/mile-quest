import { renderHook, act } from '@testing-library/react';
import { useWebSocket } from '../useWebSocket';
import { WebSocketConnectionState } from '@/services/websocket';

// Mock the WebSocket service factory
jest.mock('@/services/websocket', () => ({
  createWebSocketService: jest.fn(),
  WebSocketConnectionState: {
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    RECONNECTING: 'reconnecting',
    FAILED: 'failed',
  },
}));

// Mock auth hook
jest.mock('../useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    token: 'mock-token',
  }),
}));

describe('useWebSocket', () => {
  let mockService: any;

  beforeEach(() => {
    mockService = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
      onConnectionStateChange: jest.fn().mockReturnValue(() => {}),
      onError: jest.fn().mockReturnValue(() => {}),
    };

    const { createWebSocketService } = require('@/services/websocket');
    createWebSocketService.mockReturnValue(mockService);

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn().mockReturnValue('mock-token'),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    });

    // Mock window events
    Object.defineProperty(window, 'addEventListener', {
      value: jest.fn(),
      writable: true,
    });

    Object.defineProperty(window, 'removeEventListener', {
      value: jest.fn(),
      writable: true,
    });

    // Mock document events
    Object.defineProperty(document, 'addEventListener', {
      value: jest.fn(),
      writable: true,
    });

    Object.defineProperty(document, 'removeEventListener', {
      value: jest.fn(),
      writable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with disconnected state', () => {
    const { result } = renderHook(() => useWebSocket({ autoConnect: false }));

    expect(result.current.service).not.toBeNull();
    expect(result.current.isConnected).toBe(false);
    expect(result.current.connectionState).toBe(WebSocketConnectionState.DISCONNECTED);
    expect(result.current.error).toBeNull();
  });

  it('should auto-connect when autoConnect is true', () => {
    renderHook(() => useWebSocket({ autoConnect: true }));

    expect(mockService.connect).toHaveBeenCalled();
  });

  it('should not auto-connect when autoConnect is false', () => {
    renderHook(() => useWebSocket({ autoConnect: false }));

    expect(mockService.connect).not.toHaveBeenCalled();
  });

  it('should connect manually when connect is called', async () => {
    const { result } = renderHook(() => useWebSocket({ autoConnect: false }));

    await act(async () => {
      await result.current.connect();
    });

    expect(mockService.connect).toHaveBeenCalled();
  });

  it('should disconnect when disconnect is called', () => {
    const { result } = renderHook(() => useWebSocket({ autoConnect: false }));

    act(() => {
      result.current.disconnect();
    });

    expect(mockService.disconnect).toHaveBeenCalled();
  });

  it('should handle connection state changes', () => {
    let stateChangeCallback: (state: WebSocketConnectionState) => void;

    mockService.onConnectionStateChange.mockImplementation((callback: any) => {
      stateChangeCallback = callback;
      return () => {};
    });

    const { result } = renderHook(() => useWebSocket({ autoConnect: false }));

    act(() => {
      stateChangeCallback!(WebSocketConnectionState.CONNECTED);
    });

    expect(result.current.connectionState).toBe(WebSocketConnectionState.CONNECTED);
    expect(result.current.isConnected).toBe(true);
  });

  it('should handle errors', () => {
    let errorCallback: (error: Error) => void;

    mockService.onError.mockImplementation((callback: any) => {
      errorCallback = callback;
      return () => {};
    });

    const { result } = renderHook(() => useWebSocket({ autoConnect: false }));

    const mockError = new Error('Connection failed');

    act(() => {
      errorCallback!(mockError);
    });

    expect(result.current.error).toBe(mockError);
  });

  it('should clean up on unmount', () => {
    const { unmount } = renderHook(() => useWebSocket({ autoConnect: false }));

    unmount();

    expect(mockService.disconnect).toHaveBeenCalled();
  });

  it('should set up online/offline event listeners', () => {
    renderHook(() => useWebSocket({ autoConnect: true }));

    expect(window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
    expect(window.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    expect(document.addEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });

  it('should include auth headers in service configuration', () => {
    const { createWebSocketService } = require('@/services/websocket');

    renderHook(() => useWebSocket({ autoConnect: false }));

    expect(createWebSocketService).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: {
          headers: {
            authorization: 'Bearer mock-token',
          },
        },
      })
    );
  });
});