import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { listenForRedirect } from "../redirect.js";
import * as wsModule from "../ws.js";

describe("listenForRedirect", () => {
    let socket;
    let originalLocation;
    const studentId = 1;

    const createSocket = () => {
        const listeners = {};
        return {
            send: vi.fn(),
            addEventListener: vi.fn((event, cb, options) => {
                listeners[event] = { cb, options };
            }),
            __trigger(event, payload) {
                listeners[event]?.cb(payload);
            },
        };
    };

    const receive = (message) => {
        socket.__trigger("message", { data: JSON.stringify(message) });
    };

    beforeEach(() => {
        vi.useFakeTimers();

        // Mock window.location so assignment works
        originalLocation = global.window?.location;
        global.window = {
            location: "",
        };

        socket = createSocket();

        vi.spyOn(wsModule, "getLobbySocket").mockReturnValue(socket);
        vi.spyOn(wsModule, "getAssignmentSocket").mockReturnValue(socket);
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
        global.window.location = originalLocation;
    });

    it("redirects on session.in_progress", () => {
        listenForRedirect(studentId);

        receive({
            event: "session.in_progress",
            roomUrl: "/rooms/room-1/",
            studentIds: [studentId],
            timestamp: 1,
        });

        // Redirect is debounced, so nothing happens until the timer fires
        expect(window.location).toBe("");
        vi.advanceTimersByTime(300);
        expect(window.location).toBe("/rooms/room-1/");
    });

    it("redirects on session.start", () => {
        listenForRedirect(studentId);

        receive({
            event: "session.start",
            roomUrl: "/rooms/room-2/",
            studentIds: [studentId],
            timestamp: 1,
        });

        vi.advanceTimersByTime(300);
        expect(window.location).toBe("/rooms/room-2/");
    });

    it("only reacts to the events it was asked to listen for", () => {
        // A student who is already taking a test only follows a restart
        listenForRedirect(studentId, 42, ["session.start"]);

        receive({
            event: "session.in_progress",
            roomUrl: "/rooms/room-1/",
            studentIds: [studentId],
            assignmentId: 42,
            timestamp: 1,
        });

        vi.advanceTimersByTime(300);
        expect(window.location).toBe("");
    });

    it("redirects to the latest test-assignment when a newer one arrives", () => {
        listenForRedirect(studentId);

        // First (older) assignment
        receive({
            event: "session.start",
            roomUrl: "/rooms/room-old/",
            studentIds: [studentId],
            timestamp: 1,
        });

        // Newer assignment arrives within the debounce window
        receive({
            event: "session.in_progress",
            roomUrl: "/rooms/room-new/",
            studentIds: [studentId],
            timestamp: 2,
        });

        vi.advanceTimersByTime(300);
        expect(window.location).toBe("/rooms/room-new/");
    });

    it("keeps the newer test-assignment when an older one arrives afterwards", () => {
        listenForRedirect(studentId);

        // Newer assignment arrives first
        receive({
            event: "session.in_progress",
            roomUrl: "/rooms/room-new/",
            studentIds: [studentId],
            timestamp: 2,
        });

        // An older, out-of-order assignment arrives within the debounce window
        receive({
            event: "session.start",
            roomUrl: "/rooms/room-old/",
            studentIds: [studentId],
            timestamp: 1,
        });

        vi.advanceTimersByTime(300);
        expect(window.location).toBe("/rooms/room-new/");
    });

    it("redirects when the test-assignment matches", () => {
        listenForRedirect(studentId, 42);

        receive({
            event: "session.start",
            roomUrl: "/rooms/room-42/",
            studentIds: [studentId],
            assignmentId: 42,
            timestamp: 1,
        });

        vi.advanceTimersByTime(300);
        expect(window.location).toBe("/rooms/room-42/");
    });

    it("Does not redirect if the test-assignment does not match", () => {
        listenForRedirect(studentId, 42);

        receive({
            event: "session.start",
            roomUrl: "/rooms/room-1337/",
            studentIds: [studentId],
            assignmentId: 1337,
            timestamp: 1,
        });

        vi.advanceTimersByTime(300);
        expect(window.location).toBe("");
    });

    it("redirects to any test-assignment when no assignment is given", () => {
        listenForRedirect(studentId);

        receive({
            event: "session.start",
            roomUrl: "/rooms/room-1337/",
            studentIds: [studentId],
            assignmentId: 1337,
            timestamp: 1,
        });

        vi.advanceTimersByTime(300);
        expect(window.location).toBe("/rooms/room-1337/");
    });

    it("Does not redirect if studentId does not match", () => {
        listenForRedirect(studentId);

        receive({
            event: "session.start",
            roomUrl: "/rooms/room-2/",
            studentIds: [1337],
            timestamp: 1,
        });

        vi.advanceTimersByTime(300);
        expect(window.location).not.toBe("/rooms/room-2/");
    });

    it("does not redirect on unrelated events", () => {
        listenForRedirect(studentId);

        receive({
            event: "ping",
            roomUrl: "/should-not-redirect/",
            timestamp: 1,
        });

        vi.advanceTimersByTime(300);
        expect(window.location).not.toBe("/should-not-redirect/");
    });

    it("listens in the lobby when no assignment is given", () => {
        listenForRedirect(studentId);

        expect(wsModule.getLobbySocket).toHaveBeenCalledWith();
        expect(wsModule.getAssignmentSocket).not.toHaveBeenCalled();
    });

    it("listens in the assignment room when an assignment is given", () => {
        listenForRedirect(studentId, 42);

        expect(wsModule.getAssignmentSocket).toHaveBeenCalledWith(42);
        expect(wsModule.getLobbySocket).not.toHaveBeenCalled();
    });
});
