import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initRedirectSocket } from "../../lobby/student.js";
import * as wsModule from "../../ws.js";

// Mock getWebSocket
vi.mock("../ws.js", () => ({
    getWebSocket: vi.fn(),
}));

describe("initRedirectSocket", () => {
    let sockets;
    let originalLocation;
    let studentId;

    beforeEach(() => {
        vi.useFakeTimers();

        // Mock window.location so assignment works
        originalLocation = global.window?.location;
        global.window = {
            location: "",
        };

        sockets = {};

        // Mock getLobbySocket
        vi.spyOn(wsModule, "getLobbySocket").mockImplementation(() => {
            if (sockets["lobby"]) {
                return sockets["lobby"];
            }

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

    it("listens in the lobby room", () => {
        initRedirectSocket(studentId);

        expect(wsModule.getLobbySocket).toHaveBeenCalledTimes(1);
        expect(wsModule.getLobbySocket).toHaveBeenCalledWith();
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

    it("follows whichever session the teacher starts", () => {
        initRedirectSocket(studentId);

        const socket = sockets["lobby"];

        socket.__trigger("message", {
            data: JSON.stringify({
                event: "session.start",
                roomUrl: "/rooms/room-1337/",
                studentIds: [studentId],
                assignmentId: 1337,
            }),
        });

        expect(window.location).toBe("/rooms/room-1337/");
    });
});
