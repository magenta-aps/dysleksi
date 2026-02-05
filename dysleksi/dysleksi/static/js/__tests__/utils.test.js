/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import {startSession} from "../screening/utils";
import * as wsModule from "../ws.js";


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
