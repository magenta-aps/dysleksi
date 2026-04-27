import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initStudentLobby } from "../../lobby/student.js";
import * as wsModule from "../../ws.js";

// Mock getWebSocket
vi.mock("../ws.js", () => ({
    getWebSocket: vi.fn(),
}));

describe("initStudentLobby / initRedirectSocket", () => {
    let sockets;
    let originalLocation;
    let studentId;

    beforeEach(() => {
        sockets = {};

        // Mock window.location so assignment works
        originalLocation = global.window?.location;
        global.window = {
            location: "",
        };

        // Mock getWebSocket
        vi.spyOn(wsModule, "getWebSocket").mockImplementation(() => {
            const listeners = {};

            const socket = {
                send: vi.fn(),
                addEventListener: vi.fn((event, cb, options) => {
                    listeners[event] = { cb, options };
                }),
                __trigger(event, payload) {
                    listeners[event]?.cb(payload);
                },
            };

            sockets["lobby"] = socket;
            return socket;
        });

        studentId = 1;
    });

    afterEach(() => {
        vi.clearAllMocks();
        global.window.location = originalLocation;
    });

    it("creates redirect socket", () => {
        initStudentLobby(studentId);

        expect(wsModule.getWebSocket).toHaveBeenCalledTimes(1);
        expect(wsModule.getWebSocket).toHaveBeenCalledWith();
    });

    it("sends student.ready once when socket opens", () => {
        vi.spyOn(global.crypto, "randomUUID").mockReturnValue("UUID123");
        initStudentLobby(studentId);

        const socket = sockets["lobby"];

        socket.__trigger("open");

        expect(socket.send).toHaveBeenCalledWith(
            JSON.stringify({
                uuid: "UUID123",
                event: "student.ready",
                studentId: studentId,
            }),
        );
    });

    it("redirects on session.in_progress", () => {
        initStudentLobby(studentId);

        const socket = sockets["lobby"];

        socket.__trigger("message", {
            data: JSON.stringify({
                event: "session.in_progress",
                roomUrl: "/rooms/room-1/",
                students: [studentId],
            }),
        });

        expect(window.location).toBe("/rooms/room-1/");
    });

    it("redirects on session.start", () => {
        initStudentLobby(studentId);

        const socket = sockets["lobby"];

        socket.__trigger("message", {
            data: JSON.stringify({
                event: "session.start",
                roomUrl: "/rooms/room-2/",
                students: [studentId],
            }),
        });

        expect(window.location).toBe("/rooms/room-2/");
    });

    it("Does not redirect if studentId does not match", () => {
        initStudentLobby(studentId);

        const socket = sockets["lobby"];

        socket.__trigger("message", {
            data: JSON.stringify({
                event: "session.start",
                roomUrl: "/rooms/room-2/",
                students: [1337],
            }),
        });

        expect(window.location).not.toBe("/rooms/room-2/");
    });

    it("does not redirect on unrelated events", () => {
        initStudentLobby(studentId);

        const socket = sockets["lobby"];

        socket.__trigger("message", {
            data: JSON.stringify({
                event: "ping",
                roomUrl: "/should-not-redirect/",
            }),
        });

        expect(window.location).not.toBe("/should-not-redirect/");
    });
});
