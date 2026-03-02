/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---- Mocks ----

// Control flag to trigger error
let shouldThrowError = false;

const mockClose = vi.fn();
let openHandler;

vi.mock("../../../ws.js", () => ({
    getWebSocket: vi.fn(() => ({
        addEventListener: vi.fn((event, cb) => {
            if (event === "open") openHandler = cb;
        }),
        close: mockClose,
    })),
}));

vi.mock("../../../screening/dom.js", () => ({
    GroupTestDomElements: class {},
}));

let viewInstance;

vi.mock("../../../screening/group/student-group-test.js", () => ({
    GroupTestView: class {
        constructor() {
            if (shouldThrowError) {
                throw new Error("Init Failed");
            }
            viewInstance = this;
            this.addEventListener = vi.fn();
            this.start = vi.fn();
        }
    },
}));

// ---- Import after mocks ----
import { initStudent } from "../../../screening/group/student.js";

describe("initStudent (Group)", () => {
    let originalLocation;

    beforeEach(() => {
        vi.clearAllMocks();
        openHandler = undefined;
        viewInstance = undefined;
        shouldThrowError = false; // Reset the error flag

        originalLocation = window.location;
        delete window.location;
        window.location = { href: "" };
    });

    afterEach(() => {
        window.location = originalLocation;
    });

    it("initializes the view and starts the test when socket opens", async () => {
        initStudent("room123", "assign456", {}, {});
        await openHandler();

        expect(viewInstance).toBeDefined();
        expect(viewInstance.start).toHaveBeenCalled();
    });

    it("closes socket and redirects to /exit when test.complete is triggered", async () => {
        initStudent("room1", 42, {}, {});
        await openHandler();

        const handler = viewInstance.addEventListener.mock.calls.find(
            call => call[0] === "test.complete"
        )[1];
        
        handler();
        expect(mockClose).toHaveBeenCalled();
    });

    it("logs an error if GroupTestView construction fails", async () => {
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        
        // 1. Set the flag to true
        shouldThrowError = true;

        initStudent("room1", 42, {}, {});
        
        // 2. Wait for the async socket handler to execute
        await openHandler();

        // 3. Verify the console error was called
        expect(consoleSpy).toHaveBeenCalledWith(
            "Cannot start test because audio setup failed:",
            expect.any(Error)
        );

        consoleSpy.mockRestore();
    });
});