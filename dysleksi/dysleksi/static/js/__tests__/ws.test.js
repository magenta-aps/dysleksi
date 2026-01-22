import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getWebSocket } from '../ws.js';

describe('getWebSocket', () => {
  let originalWebSocket;
  let mockSend;

  beforeEach(() => {
    // Mock window.location correctly
    global.window = { location: { protocol: 'https:', host: 'example.com' } };

    // Save original WebSocket
    originalWebSocket = global.WebSocket;

    // Mock WebSocket as a class (constructor)
    mockSend = vi.fn();
    global.WebSocket = class {
      constructor(url) {
        this.url = url;
        this.send = mockSend;
        this.close = vi.fn();
        this.addEventListener = vi.fn();
      }
    };
  });

  afterEach(() => {
    // Restore WebSocket
    global.WebSocket = originalWebSocket;
  });

  it('uses wss protocol for https', () => {
    const ws = getWebSocket('room123');

    expect(ws.url).toBe('wss://example.com/ws/chat/room123/');
  });

  it('uses ws protocol for http', () => {
    window.location.protocol = 'http:';
    const ws = getWebSocket('abc');

    expect(ws.url).toBe('ws://example.com/ws/chat/abc/');
  });
});
