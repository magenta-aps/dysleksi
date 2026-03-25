/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DebugConsole } from "../debug.js";

describe("DebugConsole", () => {
    let logbox;
    let debugConsole;
    let originalConsole;

    beforeEach(() => {
        // Setup DOM
        document.body.innerHTML = `<div id="logbox"></div>`;
        logbox = document.getElementById("logbox");

        // Save original console
        originalConsole = { ...console };

        // Reset navigator mocks
        Object.defineProperty(global.navigator, "userAgent", {
            value: "Mozilla/5.0",
            configurable: true,
        });
        Object.defineProperty(global.navigator, "maxTouchPoints", {
            value: 0,
            configurable: true,
        });

        // Instantiate DebugConsole
        debugConsole = new DebugConsole();
    });

    afterEach(() => {
        // Restore console
        console.log = originalConsole.log;
        console.warn = originalConsole.warn;
        console.error = originalConsole.error;

        document.body.innerHTML = "";
        vi.resetModules(); // reset module cache so import re-triggers auto-init
    });

    it("should attach and log 'Debug console attached'", () => {
        const firstLine = logbox.firstChild.textContent;
        expect(firstLine).toContain("Debug console attached");
    });

    it("should override console.log and write to logbox", () => {
        console.log("hello", 123);
        const lastLine = logbox.lastChild.textContent;
        expect(lastLine).toContain(" hello 123");
    });

    it("should override console.warn and write to logbox with WARN:", () => {
        console.warn("warning");
        const lastLine = logbox.lastChild.textContent;
        expect(lastLine).toContain("WARN: warning");
    });

    it("should override console.error and write to logbox with ERROR:", () => {
        console.error("fail");
        const lastLine = logbox.lastChild.textContent;
        expect(lastLine).toContain("ERROR: fail");
    });

    it("should handle uncaught errors", () => {
        const err = new Error("uncaught");
        window.dispatchEvent(new ErrorEvent("error", { error: err }));
        const lastLine = logbox.lastChild.textContent;
        expect(lastLine).toContain("UNCAUGHT: Error: uncaught");
    });

    it("should handle uncaught without error in body", () => {
        const err = new Error("uncaught");
        window.dispatchEvent(new ErrorEvent("error", { message: err }));
        const lastLine = logbox.lastChild.textContent;
        expect(lastLine).toContain("UNCAUGHT: Error: uncaught");
    });

    it("should handle unhandled promise rejections", () => {
        const reason = new Error("promise fail");
        const dummyPromise = Promise.resolve(); // required by jsdom
        window.dispatchEvent(
            new PromiseRejectionEvent("unhandledrejection", {
                reason,
                promise: dummyPromise,
            }),
        );
        const lastLine = logbox.lastChild.textContent;
        expect(lastLine).toContain("PROMISE: Error: promise fail");
    });

    it("should hide logbox on non-iPad", () => {
        expect(logbox.style.display).toBe("none");
    });

    it("should NOT hide logbox on iPad", () => {
        Object.defineProperty(global.navigator, "userAgent", {
            value: "iPad",
            configurable: true,
        });
        Object.defineProperty(global.navigator, "maxTouchPoints", {
            value: 5,
            configurable: true,
        });

        document.body.innerHTML = `<div id="logbox"></div>`;
        const lb = document.getElementById("logbox");
        const consoleInstance = new DebugConsole();
        expect(lb.style.display).not.toBe("none");
    });

    it("formatArg should stringify objects, errors, and primitives", () => {
        const obj = { a: 1 };
        const err = new Error("err");
        expect(debugConsole.formatArg(obj)).toBe(JSON.stringify(obj, null, 2));
        expect(debugConsole.formatArg(err)).toContain("Error: err");
        expect(debugConsole.formatArg("text")).toBe("text");
        expect(debugConsole.formatArg(42)).toBe("42");
        expect(debugConsole.formatArg(null)).toBe("null");
    });

    it("formatArg should handle invalid JSON objects", () => {
        const circularObj = {};
        circularObj.self = circularObj; // circular reference!

        const debugConsole = new DebugConsole();

        const result = debugConsole.formatArg(circularObj);

        // Should fall back to String(obj), which returns "[object Object]"
        expect(result).toBe("[object Object]");
    });

    it("should auto-initialize if logbox exists", async () => {
        // Import AFTER creating the logbox
        const module = await import("../debug.js"); // path to your debug.js
        const firstLine = logbox.firstChild.textContent;

        expect(firstLine).toContain("Debug console attached");
    });
});
