import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getWebSocket } from '../ws.js';

describe('getWebSocket', () => {
  let originalWebSocket;
  let mockSend;

  beforeEach(() => {
    global.window = { location: { protocol: 'https:', host: 'example.com' } };
    originalWebSocket = global.WebSocket;

    mockSend = vi.fn();

    // Define the class and its methods on the prototype
    global.WebSocket = class {
      constructor(url) {
        this.url = url;
        this.readyState = 1; // 1 = OPEN
        this.send = mockSend;
      }
      // Defining these here puts them on the prototype
      close() {}
      addEventListener() {}
    };

    // Set the constants your code relies on
    global.WebSocket.OPEN = 1;
    global.WebSocket.CONNECTING = 0;
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

  it('removes the socket from the cache when it closes', () => {
    let closeCallback;

    // 1. Spy on the prototype before calling the function
    const addEventListenerSpy = vi.spyOn(global.WebSocket.prototype, 'addEventListener')
      .mockImplementation((event, callback) => {
        if (event === 'close') {
          closeCallback = callback;
        }
      });

    // 2. Create the first socket
    const firstWs = getWebSocket('room-to-close');

    // Verify the listener was actually attached
    expect(addEventListenerSpy).toHaveBeenCalledWith('close', expect.any(Function));

    // 3. Manually trigger the 'close' callback that was captured
    if (closeCallback) closeCallback();

    // 4. Call getWebSocket again for the same ID
    const secondWs = getWebSocket('room-to-close');

    // 5. Assert: They MUST be different objects now
    expect(secondWs).not.toBe(firstWs);

    addEventListenerSpy.mockRestore();
  });
});