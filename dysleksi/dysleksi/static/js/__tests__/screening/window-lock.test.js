/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
    WindowLock,
    showWindowBlockedMessage,
    WINDOW_BLOCKED_EVENT,
} from "../../screening/window-lock.js";

describe("WindowLock", () => {
    const URL = "/assignment/1/window-lock/";
    const CSRF = "csrf-token";
    let lock;

    const answer = (granted) =>
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ granted: granted }),
        });

    // Every lock keeps a "pagehide" listener on the window, so locks from
    // earlier tests answer that event too. Look at our own requests only.
    const requests = () =>
        global.fetch.mock.calls
            .map(([, options]) => JSON.parse(options.body))
            .filter((body) => body.windowId === lock.windowId);

    beforeEach(() => {
        vi.useFakeTimers();
        global.fetch = vi
            .fn()
            .mockResolvedValue({ ok: true, json: async () => ({ granted: true }) });
        lock = new WindowLock(URL, CSRF);
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("runs the test when the server grants the lock", async () => {
        answer(true);

        expect(await lock.acquire()).toBe(true);
    });

    it("blocks the window when the server refuses the lock", async () => {
        answer(false);

        expect(await lock.acquire()).toBe(false);
    });

    it("does not keep asking once it has been refused", async () => {
        answer(false);
        await lock.acquire();

        await vi.advanceTimersByTimeAsync(30 * 1000);

        expect(requests()).toHaveLength(1);
    });

    it("tells the server that it is still open", async () => {
        answer(true);
        await lock.acquire();

        await vi.advanceTimersByTimeAsync(10 * 1000);

        // Only the first request opens the window, the rest keep it alive
        expect(requests()).toEqual([
            { windowId: lock.windowId, acquire: true },
            { windowId: lock.windowId },
            { windowId: lock.windowId },
        ]);
    });

    it("blocks the window if it loses the lock while running", async () => {
        document.body.innerHTML = `<div id="window-blocked" class="d-none"></div>`;
        answer(true);
        await lock.acquire();

        // Another window took the test over while we were away
        answer(false);
        await vi.advanceTimersByTimeAsync(5 * 1000);

        expect(
            document.getElementById("window-blocked").classList.contains("d-none"),
        ).toBe(false);

        // ...and it stops asking after that
        await vi.advanceTimersByTimeAsync(30 * 1000);
        expect(requests()).toHaveLength(2);
    });

    it("hands the lock back when the window goes away", async () => {
        answer(true);
        await lock.acquire();

        window.dispatchEvent(new Event("pagehide"));
        await vi.advanceTimersByTimeAsync(0);

        expect(requests()[1]).toEqual({ windowId: lock.windowId, release: true });

        // A released window has nothing left to tell the server
        await vi.advanceTimersByTimeAsync(30 * 1000);
        expect(requests()).toHaveLength(2);
    });

    it("keeps running when the server cannot be reached", async () => {
        // Being offline is not the same as being refused, so we should grant the lock
        global.fetch.mockRejectedValueOnce(new Error("offline"));

        expect(await lock.acquire()).toBe(true);
    });

    it("keeps running when the server answers with an error", async () => {
        // Server errors should not be the reason that a test cannot be started
        global.fetch.mockResolvedValueOnce({ ok: false, status: 500 });

        expect(await lock.acquire()).toBe(true);
    });
});

describe("showWindowBlockedMessage", () => {
    it("shows the blocked message", () => {
        document.body.innerHTML = `<div id="window-blocked" class="d-none"></div>`;
        showWindowBlockedMessage();
        expect(
            document.getElementById("window-blocked").classList.contains("d-none"),
        ).toBe(false);
    });

    it("tells the rest of the page that this window is out of the test", () => {
        document.body.innerHTML = `<div id="window-blocked" class="d-none"></div>`;
        const blocked = vi.fn();
        document.addEventListener(WINDOW_BLOCKED_EVENT, blocked);

        showWindowBlockedMessage();

        expect(blocked).toHaveBeenCalled();
    });
});
