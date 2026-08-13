/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ErrorReporter } from "../error-reporting.js";

const URL = "/client-error/";
const CSRF_TOKEN = "token123";

describe("ErrorReporter", () => {
    let reporter;
    let consoleErrorSpy;
    let originalConsoleError;
    let attachedHandlers;

    function payloads() {
        return global.fetch.mock.calls.map((call) => JSON.parse(call[1].body));
    }

    function csrfTokens() {
        return global.fetch.mock.calls.map((call) => call[1].headers["X-CSRFToken"]);
    }

    beforeEach(() => {
        global.fetch = vi.fn(() => Promise.resolve({ ok: true }));

        originalConsoleError = console.error;
        consoleErrorSpy = vi.fn();
        console.error = consoleErrorSpy;

        // Keep track of the window handlers each reporter attaches, so they can
        // be removed again after the test. Otherwise reporters from earlier
        // tests would also report the events dispatched by later ones.
        attachedHandlers = [];
        const addEventListener = window.addEventListener.bind(window);
        vi.spyOn(window, "addEventListener").mockImplementation(
            (type, handler, options) => {
                attachedHandlers.push([type, handler]);
                addEventListener(type, handler, options);
            },
        );

        reporter = new ErrorReporter(URL, CSRF_TOKEN);
    });

    afterEach(() => {
        for (const [type, handler] of attachedHandlers) {
            window.removeEventListener(type, handler);
        }
        console.error = originalConsoleError;
        document.body.innerHTML = "";
        vi.restoreAllMocks();
        vi.resetModules(); // reset module cache so import re-triggers auto-init
    });

    it("posts to the configured url with the csrf token", async () => {
        console.error("something broke");

        await vi.waitFor(() => expect(global.fetch).toHaveBeenCalledOnce());
        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toBe(URL);
        expect(options.method).toBe("POST");
        expect(options.headers["X-CSRFToken"]).toBe(CSRF_TOKEN);
        expect(options.headers["Content-Type"]).toBe("application/json");
        expect(options.keepalive).toBe(true);
    });

    it("reports console.error and still writes to the console", () => {
        console.error("failed to load", { id: 4 });

        expect(consoleErrorSpy).toHaveBeenCalledWith("failed to load", { id: 4 });
        expect(reporter.reportCount).toBe(1);
        const payload = payloads()[0];
        expect(payload.kind).toBe("console.error");
        expect(payload.message).toBe('failed to load {"id":4}');
        expect(payload.stack).toBeNull();
        expect(payload.url).toBe(window.location.href);
        expect(payload.user_agent).toBe(navigator.userAgent);
    });

    it("includes the stack when console.error is given an error", () => {
        console.error("could not play sound:", new Error("no audio"));

        const payload = payloads()[0];
        expect(payload.message).toContain("Error: no audio");
        expect(payload.stack).toContain("Error: no audio");
    });

    it("reports uncaught errors", () => {
        window.dispatchEvent(
            new ErrorEvent("error", {
                error: new TypeError("x is not a function"),
                filename: "https://dysleksi-web/static/js/screening/dom.js",
                lineno: 12,
                colno: 34,
            }),
        );

        const payload = payloads()[0];
        expect(payload.kind).toBe("uncaught");
        expect(payload.message).toBe("TypeError: x is not a function");
        expect(payload.stack).toContain("TypeError: x is not a function");
        expect(payload.source).toBe(
            "https://dysleksi-web/static/js/screening/dom.js:12:34",
        );
    });

    it("reports uncaught events without an error object", () => {
        window.dispatchEvent(
            new ErrorEvent("error", {
                message: "Script error.",
                filename: "https://example.com/other.js",
                lineno: 1,
                colno: 2,
            }),
        );

        const payload = payloads()[0];
        expect(payload.kind).toBe("uncaught");
        expect(payload.message).toBe("Script error.");
        expect(payload.stack).toBeNull();
        expect(payload.source).toBe("https://example.com/other.js:1:2");
    });

    it("reports uncaught events without message or source", () => {
        window.dispatchEvent(new ErrorEvent("error", {}));

        const payload = payloads()[0];
        expect(payload.message).toBe("Unknown error");
        expect(payload.source).toBeNull();
    });

    it("reports unhandled promise rejections", () => {
        window.dispatchEvent(
            new PromiseRejectionEvent("unhandledrejection", {
                reason: new Error("fetch failed"),
                promise: Promise.resolve(),
            }),
        );

        const payload = payloads()[0];
        expect(payload.kind).toBe("unhandledrejection");
        expect(payload.message).toBe("Error: fetch failed");
        expect(payload.stack).toContain("Error: fetch failed");
    });

    it("reports rejections without an error as reason", () => {
        window.dispatchEvent(
            new PromiseRejectionEvent("unhandledrejection", {
                reason: "just a string",
                promise: Promise.resolve(),
            }),
        );

        const payload = payloads()[0];
        expect(payload.message).toBe("just a string");
        expect(payload.stack).toBeNull();
    });

    it("reports every occurrence of the same error", () => {
        const error = new TypeError("the same error again");
        for (const _ of [1, 2, 3]) {
            window.dispatchEvent(new ErrorEvent("error", { error: error }));
        }

        expect(global.fetch).toHaveBeenCalledTimes(3);
        expect(payloads().map((payload) => payload.message)).toEqual([
            "TypeError: the same error again",
            "TypeError: the same error again",
            "TypeError: the same error again",
        ]);
    });

    it("reports reaching the maximum number of reports, then stops", () => {
        const limitedReporter = new ErrorReporter(URL, CSRF_TOKEN, 2);
        for (const message of ["one", "two", "three", "four"]) {
            limitedReporter.report({ kind: "uncaught", message: message });
        }

        expect(global.fetch).toHaveBeenCalledTimes(3);
        const reported = payloads();
        expect(reported.slice(0, 2).map((payload) => payload.message)).toEqual([
            "one",
            "two",
        ]);
        expect(reported[2].kind).toBe("limit");
        expect(reported[2].message).toBe(
            "Reached the limit of 2 reports for this page load, " +
                "further errors are not reported",
        );
    });

    it("truncates long messages and stacks", () => {
        reporter.report({
            kind: "uncaught",
            message: "m".repeat(3000),
            stack: "s".repeat(5000),
        });

        const payload = payloads()[0];
        expect(payload.message).toHaveLength(2000);
        expect(payload.stack).toHaveLength(4000);
    });

    it("does not report through the wrapped console when reporting fails", async () => {
        global.fetch = vi.fn(() => Promise.reject(new Error("offline")));

        reporter.report({ kind: "uncaught", message: "boom" });

        await vi.waitFor(() => expect(consoleErrorSpy).toHaveBeenCalled());
        expect(consoleErrorSpy.mock.calls[0][0]).toBe(
            "Could not report error to server:",
        );
        // The failure was logged without being reported, so nothing was posted again
        expect(global.fetch).toHaveBeenCalledOnce();
        expect(reporter.reportCount).toBe(1);
    });

    it("stackOf returns null for anything but an error with a stack", () => {
        const stackless = new Error("no stack");
        delete stackless.stack;

        expect(reporter.stackOf(new Error("with stack"))).toContain(
            "Error: with stack",
        );
        expect(reporter.stackOf(stackless)).toBeNull();
        expect(reporter.stackOf("just a string")).toBeNull();
        expect(reporter.stackOf(undefined)).toBeNull();
    });

    it("formatArg stringifies errors, objects and primitives", () => {
        const circular = {};
        circular.self = circular;

        expect(reporter.formatArg(new Error("err"))).toBe("Error: err");
        expect(reporter.formatArg({ a: 1 })).toBe('{"a":1}');
        expect(reporter.formatArg(circular)).toBe("[object Object]");
        expect(reporter.formatArg("text")).toBe("text");
        expect(reporter.formatArg(42)).toBe("42");
        expect(reporter.formatArg(null)).toBe("null");
    });

    it("initializes itself from the config element", async () => {
        document.body.innerHTML = `
            <script id="client-error-log-config" type="application/json">
                {"url": "/client-error/", "csrf_token": "from-config"}
            </script>`;

        await import("../error-reporting.js");
        console.error("after auto init");

        expect(csrfTokens()).toContain("from-config");
    });

    it("does nothing without a config element", async () => {
        await import("../error-reporting.js");

        expect(global.fetch).not.toHaveBeenCalled();
    });
});
