/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AutoLogout } from "../auto-logout.js";

const TIMEOUT = 600;
const PING_URL = "/ping";
const LOGOUT_URL = "/logout";

const config = (overrides = {}) => ({
    enabled: true,
    logout_on_idle: true,
    timeout: TIMEOUT,
    ping_url: PING_URL,
    logout_url: LOGOUT_URL,
    ...overrides,
});

describe("AutoLogout", () => {
    let originalLocation;

    const activity = () =>
        document.dispatchEvent(new Event("pointerdown", { bubbles: true }));

    const minutes = (count) => vi.advanceTimersByTimeAsync(count * 60 * 1000);

    beforeEach(() => {
        vi.useFakeTimers();
        global.fetch = vi.fn().mockResolvedValue({ ok: true });
        // jsdom does not navigate, so replace the location
        originalLocation = window.location;
        delete window.location;
        window.location = "";
    });

    afterEach(() => {
        window.location = originalLocation;
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.restoreAllMocks();
        document.body.innerHTML = "";
        vi.resetModules(); // reset module cache so import re-triggers auto-init
    });

    it("logs out an inactive user", async () => {
        new AutoLogout(config()).start();

        await minutes(9);
        expect(window.location).toBe("");

        await minutes(2);
        expect(window.location).toBe(LOGOUT_URL);
    });

    it("keeps an active user logged in", async () => {
        new AutoLogout(config()).start();

        for (let i = 0; i < 4; i++) {
            await minutes(5);
            activity();
        }

        expect(window.location).toBe("");
        // The server is told about the activity, so the session lives on too
        expect(global.fetch).toHaveBeenCalledWith(PING_URL);
    });

    it("only tells the server about the user when something happened", async () => {
        new AutoLogout(config()).start();

        activity();
        await minutes(2);
        // One interaction is worth one ping, however often the timer ticks
        expect(global.fetch).toHaveBeenCalledTimes(1);

        // Nothing keeps the session alive while the user is away
        await minutes(5);
        expect(global.fetch).toHaveBeenCalledTimes(1);

        activity();
        await minutes(1);
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("does not log out during a test, but keeps the session alive", async () => {
        new AutoLogout(config({ logout_on_idle: false })).start();

        await minutes(60);

        expect(window.location).toBe("");
        expect(global.fetch).toHaveBeenCalledWith(PING_URL);
    });

    it("survives a ping that does not reach the server", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        global.fetch.mockRejectedValue(new Error("offline"));
        new AutoLogout(config({ logout_on_idle: false })).start();

        await minutes(2);

        expect(warn).toHaveBeenCalled();
        expect(window.location).toBe("");
    });

    it("starts itself when the page provides a config", async () => {
        document.body.innerHTML = `<script id="auto-logout-config" type="application/json">
            ${JSON.stringify(config())}</script>`;

        await import("../auto-logout.js");

        await minutes(11);
        expect(window.location).toBe(LOGOUT_URL);
    });

    it("stays out of the way when the user is not logged in", async () => {
        document.body.innerHTML = `<script id="auto-logout-config" type="application/json">
            ${JSON.stringify(config({ enabled: false }))}</script>`;

        await import("../auto-logout.js");

        await minutes(11);
        expect(window.location).toBe("");
        expect(global.fetch).not.toHaveBeenCalled();
    });
});
