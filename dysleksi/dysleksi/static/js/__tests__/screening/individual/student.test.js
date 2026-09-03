/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---- Mocks ----

// Mock websocket
const mockSend = vi.fn();
const mockClose = vi.fn();
let openHandler;

vi.mock("../../../ws.js", () => ({
    getAssignmentSocket: vi.fn(() => ({
        addEventListener: vi.fn((event, cb) => {
            if (event === "open") openHandler = cb;
        }),
        send: mockSend,
        close: mockClose,
    })),
}));

// Mock DOM elements as a proper class
vi.mock("../../../screening/dom.js", () => ({
    IndividualTestDomElements: class {},
}));

// Mock MediaRecorder as a class
const mockSetup = vi.fn();

vi.mock("../../../screening/media.js", () => ({
    TestMediaRecorder: class {
        constructor() {}
        setup() {
            return mockSetup();
        }
    },
}));

// Mock View as a class
let viewInstance;

vi.mock("../../../screening/individual/student-individual-test.js", () => ({
    IndividualTestView: class {
        constructor() {
            viewInstance = this;
        }
        addEventListener = vi.fn();
        start = vi.fn();
    },
}));

// ---- Import after mocks ----
import { initStudent } from "../../../screening/individual/student.js";

describe("initStudent", () => {
    let originalLocation;

    beforeEach(() => {
        vi.clearAllMocks();
        openHandler = undefined;

        vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("uuid-123");

        // Save original
        originalLocation = window.location;

        // Replace with mock object
        delete window.location;
        window.location = { href: "" };
    });

    afterEach(() => {
        window.location = originalLocation;
    });

    it("covers successful setup path and test completion", async () => {
        mockSetup.mockResolvedValueOnce();

        initStudent("room1", 42, {});

        // simulate socket open
        await openHandler();

        // setup was called
        expect(mockSetup).toHaveBeenCalled();

        // view was started
        expect(viewInstance.start).toHaveBeenCalled();
    });

    it("covers setup error path", async () => {
        mockSetup.mockRejectedValueOnce(new Error("mic failed"));

        const mockStudent = {
            displayName: "Elev E.",
        };

        initStudent(42, {}, mockStudent);

        await openHandler();

        expect(mockSend).toHaveBeenCalledWith(
            JSON.stringify({
                uuid: "uuid-123",
                event: "setup.error",
                error: "Error: mic failed",
                studentDisplayName: mockStudent.displayName,
            }),
        );

        // View should still be constructed & started
        expect(viewInstance.start).toHaveBeenCalled();
    });
});
