import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initRedirectSocket } from "../../lobby/student.js";
import * as wsModule from "../../ws.js";

// Mock getWebSocket
vi.mock("../ws.js", () => ({
    getWebSocket: vi.fn(),
}));

describe("initRedirectSocket / initRedirectSocket", () => {
    let sockets;
    let originalLocation;
    let studentId;

    beforeEach(() => {
        sockets = {};

        vi.useFakeTimers();

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
        vi.useRealTimers();
        global.window.location = originalLocation;
    });

    it("creates redirect socket", () => {
        initRedirectSocket(studentId);

        expect(wsModule.getWebSocket).toHaveBeenCalledTimes(1);
        expect(wsModule.getWebSocket).toHaveBeenCalledWith();
    });

    it("sends student.ready once when socket opens", () => {
        vi.spyOn(global.crypto, "randomUUID").mockReturnValue("UUID123");
        initRedirectSocket(studentId);

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
        initRedirectSocket(studentId);

        const socket = sockets["lobby"];

        socket.__trigger("message", {
            data: JSON.stringify({
                event: "session.in_progress",
                roomUrl: "/rooms/room-1/",
                students: [studentId],
                timestamp: 1,
            }),
        });

        // Redirect is debounced, so nothing happens until the timer fires
        expect(window.location).toBe("");
        vi.advanceTimersByTime(300);
        expect(window.location).toBe("/rooms/room-1/");
    });

    it("redirects on session.start", () => {
        initRedirectSocket(studentId);

        const socket = sockets["lobby"];

        socket.__trigger("message", {
            data: JSON.stringify({
                event: "session.start",
                roomUrl: "/rooms/room-2/",
                students: [studentId],
                timestamp: 1,
            }),
        });

        vi.advanceTimersByTime(300);
        expect(window.location).toBe("/rooms/room-2/");
    });

    it("redirects to the latest test-assignment when a newer one arrives", () => {
        initRedirectSocket(studentId);

        const socket = sockets["lobby"];

        // First (older) assignment
        socket.__trigger("message", {
            data: JSON.stringify({
                event: "session.start",
                roomUrl: "/rooms/room-old/",
                students: [studentId],
                timestamp: 1,
            }),
        });

        // Newer assignment arrives within the debounce window
        socket.__trigger("message", {
            data: JSON.stringify({
                event: "session.in_progress",
                roomUrl: "/rooms/room-new/",
                students: [studentId],
                timestamp: 2,
            }),
        });

        vi.advanceTimersByTime(300);
        expect(window.location).toBe("/rooms/room-new/");
    });

    it("keeps the newer test-assignment when an older one arrives afterwards", () => {
        initRedirectSocket(studentId);

        const socket = sockets["lobby"];

        // Newer assignment arrives first
        socket.__trigger("message", {
            data: JSON.stringify({
                event: "session.in_progress",
                roomUrl: "/rooms/room-new/",
                students: [studentId],
                timestamp: 2,
            }),
        });

        // An older, out-of-order assignment arrives within the debounce window
        socket.__trigger("message", {
            data: JSON.stringify({
                event: "session.start",
                roomUrl: "/rooms/room-old/",
                students: [studentId],
                timestamp: 1,
            }),
        });

        vi.advanceTimersByTime(300);
        expect(window.location).toBe("/rooms/room-new/");
    });

    it("redirects when the test-assignment matches", () => {
        initRedirectSocket(studentId, 42);

        const socket = sockets["lobby"];

        socket.__trigger("message", {
            data: JSON.stringify({
                event: "session.start",
                roomUrl: "/rooms/room-42/",
                students: [studentId],
                assignmentId: 42,
                timestamp: 1,
            }),
        });

        vi.advanceTimersByTime(300);
        expect(window.location).toBe("/rooms/room-42/");
    });

    it("Does not redirect if the test-assignment does not match", () => {
        initRedirectSocket(studentId, 42);

        const socket = sockets["lobby"];

        socket.__trigger("message", {
            data: JSON.stringify({
                event: "session.start",
                roomUrl: "/rooms/room-1337/",
                students: [studentId],
                assignmentId: 1337,
                timestamp: 1,
            }),
        });

        vi.advanceTimersByTime(300);
        expect(window.location).toBe("");
    });

    it("redirects to any test-assignment when no assignment is given", () => {
        // A student waiting in the lobby is not tied to a single assignment,
        // and should therefore follow whichever one the teacher starts
        initRedirectSocket(studentId);

        const socket = sockets["lobby"];

        socket.__trigger("message", {
            data: JSON.stringify({
                event: "session.start",
                roomUrl: "/rooms/room-1337/",
                students: [studentId],
                assignmentId: 1337,
                timestamp: 1,
            }),
        });

        vi.advanceTimersByTime(300);
        expect(window.location).toBe("/rooms/room-1337/");
    });

    it("Does not redirect if studentId does not match", () => {
        initRedirectSocket(studentId);

        const socket = sockets["lobby"];

        socket.__trigger("message", {
            data: JSON.stringify({
                event: "session.start",
                roomUrl: "/rooms/room-2/",
                students: [1337],
                timestamp: 1,
            }),
        });

        vi.advanceTimersByTime(300);
        expect(window.location).not.toBe("/rooms/room-2/");
    });

    it("does not redirect on unrelated events", () => {
        initRedirectSocket(studentId);

        const socket = sockets["lobby"];

        socket.__trigger("message", {
            data: JSON.stringify({
                event: "ping",
                roomUrl: "/should-not-redirect/",
                timestamp: 1,
            }),
        });

        vi.advanceTimersByTime(300);
        expect(window.location).not.toBe("/should-not-redirect/");
    });
});
