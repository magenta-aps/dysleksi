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
        global.window.location = originalLocation;
    });

    it("redirects on session.in_progress", () => {
        listenForRedirect(studentId);

        receive({
            event: "session.in_progress",
            roomUrl: "/rooms/room-1/",
            studentIds: [studentId],
        });

        expect(window.location).toBe("/rooms/room-1/");
    });

    it("redirects on session.start", () => {
        listenForRedirect(studentId);

        receive({
            event: "session.start",
            roomUrl: "/rooms/room-2/",
            studentIds: [studentId],
        });

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
        });

        expect(window.location).toBe("");
    });

    it("redirects when the test-assignment matches", () => {
        listenForRedirect(studentId, 42);

        receive({
            event: "session.start",
            roomUrl: "/rooms/room-42/",
            studentIds: [studentId],
            assignmentId: 42,
        });

        expect(window.location).toBe("/rooms/room-42/");
    });

    it("Does not redirect if the test-assignment does not match", () => {
        listenForRedirect(studentId, 42);

        receive({
            event: "session.start",
            roomUrl: "/rooms/room-1337/",
            studentIds: [studentId],
            assignmentId: 1337,
        });

        expect(window.location).toBe("");
    });

    it("redirects to any test-assignment when no assignment is given", () => {
        listenForRedirect(studentId);

        receive({
            event: "session.start",
            roomUrl: "/rooms/room-1337/",
            studentIds: [studentId],
            assignmentId: 1337,
        });

        expect(window.location).toBe("/rooms/room-1337/");
    });

    it("Does not redirect if studentId does not match", () => {
        listenForRedirect(studentId);

        receive({
            event: "session.start",
            roomUrl: "/rooms/room-2/",
            studentIds: [1337],
        });

        expect(window.location).not.toBe("/rooms/room-2/");
    });

    it("does not redirect on unrelated events", () => {
        listenForRedirect(studentId);

        receive({
            event: "ping",
            roomUrl: "/should-not-redirect/",
        });

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
