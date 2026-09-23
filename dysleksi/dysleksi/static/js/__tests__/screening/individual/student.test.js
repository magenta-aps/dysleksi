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
const mockShowMicLostOverlay = vi.fn();
const mockHideMicLostOverlay = vi.fn();
let restoreMicListener;

vi.mock("../../../screening/dom.js", () => ({
    IndividualTestDomElements: class {
        showMicLostOverlay = mockShowMicLostOverlay;
        hideMicLostOverlay = mockHideMicLostOverlay;
        setRestoreMicButtonListener = (listener) => {
            restoreMicListener = listener;
        };
    },
}));

// Mock MediaRecorder as a class
const mockSetup = vi.fn();

let micLostHandler;
let micRestoredHandler;

vi.mock("../../../screening/media.js", () => ({
    TestMediaRecorder: class {
        constructor() {}
        addEventListener(event, cb) {
            if (event === "mic.lost") micLostHandler = cb;
            if (event === "mic.restored") micRestoredHandler = cb;
        }
        async setup() {
            await mockSetup();
            this.mediaRecorder = {};
        }
        async restore() {
            await this.setup().catch(() => {});
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

    it("waits for microphone permission before starting the test", async () => {
        mockSetup.mockRejectedValueOnce(new Error("mic failed"));
        mockSetup.mockRejectedValueOnce(new Error("mic failed"));

        const mockStudent = {
            displayName: "Elev E.",
        };

        initStudent(42, {}, mockStudent);

        const started = openHandler();
        await vi.waitFor(() => expect(mockShowMicLostOverlay).toHaveBeenCalled());

        expect(mockSend).toHaveBeenCalledWith(
            JSON.stringify({
                uuid: "uuid-123",
                studentDisplayName: mockStudent.displayName,
                event: "setup.error",
                error: "Error: mic failed",
            }),
        );

        // Permission is still denied when the student tries again
        restoreMicListener();
        await vi.waitFor(() => expect(mockShowMicLostOverlay).toHaveBeenCalledTimes(2));

        // Permission is granted, so the test starts
        restoreMicListener();
        await started;
        expect(mockHideMicLostOverlay).toHaveBeenCalled();
        expect(viewInstance.start).toHaveBeenCalled();
    });

    it("reports a microphone lost and restored during the test", async () => {
        mockSetup.mockResolvedValueOnce();

        initStudent(42, {}, { displayName: "Elev E." });

        await openHandler();
        micLostHandler();

        expect(mockSend).toHaveBeenCalledWith(
            JSON.stringify({
                uuid: "uuid-123",
                studentDisplayName: "Elev E.",
                event: "setup.error",
                error: "microphone access lost",
            }),
        );

        micRestoredHandler();

        expect(mockSend).toHaveBeenCalledWith(
            JSON.stringify({
                uuid: "uuid-123",
                studentDisplayName: "Elev E.",
                event: "setup.restored",
            }),
        );
    });
});
