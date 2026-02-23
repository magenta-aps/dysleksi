/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {startSession, refreshSession} from "../screening/utils";
import * as wsModule from "../ws.js";
import {getWebSocket} from "../ws.js";


// Mock getWebSocket
vi.mock("../ws.js", () => ({
    getWebSocket: vi.fn(),
}));
// Mock getWebSocket
const sockets = {};
vi.spyOn(wsModule, "getWebSocket").mockImplementation((roomName) => {
    if (sockets[roomName]) return sockets[roomName];
    const listeners = {};

    const socket = {
        send: vi.fn((data) => {}),
        addEventListener: vi.fn((event, cb, options) => {
            listeners[event] = { cb, options };
        }),
        __trigger(event, payload) {
            listeners[event]?.cb(payload);
        },
        readyState: WebSocket.OPEN,
    };

    sockets[roomName] = socket;
    return socket;
});

describe('test startSession', () => {

    it('should send session.start event', () => {
        vi.spyOn(global.crypto, "randomUUID").mockReturnValue("UUID123");
        const roomName = "room-1";
        const chatSocket = startSession(roomName);
        expect(chatSocket.addEventListener).toHaveBeenCalled();

        chatSocket.__trigger("open");
        expect(chatSocket.send).toHaveBeenCalledWith(JSON.stringify({
            uuid: "UUID123",
            event: "session.start",
            roomUrl: "/",
        }));

    });


    it('should refresh session', () => {
        vi.spyOn(global.crypto, "randomUUID").mockReturnValue("UUID123");

        const roomName = "room-1";
        let chatSocket = startSession(roomName);
        expect(chatSocket.addEventListener).toHaveBeenCalled();

        chatSocket.__trigger(
            "message",
            {"data": JSON.stringify({"event": "student.ready"})}
        );
        expect(chatSocket.send).toHaveBeenCalled();
        expect(chatSocket.send).toHaveBeenCalledWith(JSON.stringify({
            uuid: "UUID123",
            event: "session.in_progress",
            roomUrl: "/",
        }));

    });

});

describe('wake lock utils', () => {
    let mockWakeLockSentinel;

    beforeEach(() => {
        mockWakeLockSentinel = {
            release: vi.fn(),           // sync now
            addEventListener: vi.fn(),
        };

        global.navigator.wakeLock = {
            request: vi.fn().mockResolvedValue(mockWakeLockSentinel),
        };

        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});

        vi.resetModules(); // important: reset module to clear module-level wakeLock
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should request a wake lock and log success', async () => {
        const { requestWakeLock } = await import('../screening/utils');

        await requestWakeLock();

        expect(global.navigator.wakeLock.request).toHaveBeenCalledWith('screen');
        expect(mockWakeLockSentinel.addEventListener).toHaveBeenCalledWith(
            'release',
            expect.any(Function)
        );
        expect(console.log).toHaveBeenCalledWith('Screen wake lock active');
    });

    it('should handle errors gracefully', async () => {
        const err = new Error('Fail');
        global.navigator.wakeLock.request.mockRejectedValue(err);

        const { requestWakeLock } = await import('../screening/utils');

        await requestWakeLock();

        expect(console.error).toHaveBeenCalledWith('Error, Fail');
    });

    it('should release the wake lock if it exists', async () => {
        const { requestWakeLock, releaseWakeLock } = await import('../screening/utils');

        await requestWakeLock();
        releaseWakeLock();

        expect(mockWakeLockSentinel.release).toHaveBeenCalled();

        // manually trigger release event to check console.log
        mockWakeLockSentinel.addEventListener.mock.calls.forEach(([event, callback]) => {
            if (event === 'release') callback();
        });

        expect(console.log).toHaveBeenCalledWith('Screen wake lock released');
    });

    it('should do nothing if wake lock is not set when releasing', async () => {
        const { releaseWakeLock } = await import('../screening/utils');

        expect(() => releaseWakeLock()).not.toThrow();
    });
});
