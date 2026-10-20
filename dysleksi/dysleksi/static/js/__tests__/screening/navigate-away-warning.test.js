/**
 * @vitest-environment jsdom
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import { NavigateAwayWarning } from "../../screening/controlroom.js";

describe("NavigateAwayWarning: beforeunload event", () => {
    it("intercepts navigation if toggled on", () => {
        const instance = new NavigateAwayWarning();
        const spyHandleBeforeUnload = vi.spyOn(instance, "handleBeforeUnload");
        instance.toggle(true);
        global.window.dispatchEvent(new Event("beforeunload"));
        expect(spyHandleBeforeUnload).toBeCalled();
    });

    it("does not intercept navigation if toggled off", () => {
        const instance = new NavigateAwayWarning();
        const spyHandleBeforeUnload = vi.spyOn(instance, "handleBeforeUnload");
        instance.toggle(false);
        global.window.dispatchEvent(new Event("beforeunload"));
        expect(spyHandleBeforeUnload).not.toBeCalled();
    });
});

class MockEvent extends Event {
    preventDefault = vi.fn();
}

describe("NavigateAwayWarning: navigate event", () => {
    beforeEach(() => {
        global.window.navigation = new EventTarget();
        global.window.confirm = vi.fn();
    });

    it("intercepts navigation if toggled on and user confirms", () => {
        const mockEvent = new MockEvent("navigate");
        const instance = new NavigateAwayWarning();
        instance.toggle(true);
        global.window.confirm.mockReturnValue(false); // user leaves page
        global.window.navigation.dispatchEvent(mockEvent);
        expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it("does not intercept navigation if toggled on and user aborts", () => {
        const mockEvent = new MockEvent("navigate");
        const instance = new NavigateAwayWarning();
        instance.toggle(true);
        global.window.confirm.mockReturnValue(true); // user aborts navigation
        global.window.navigation.dispatchEvent(mockEvent);
        expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    });

    it("does not intercept navigation if toggled off", () => {
        const mockEvent = new MockEvent("navigate");
        const instance = new NavigateAwayWarning();
        instance.toggle(false);
        global.window.navigation.dispatchEvent(mockEvent);
        expect(mockEvent.preventDefault).not.toBeCalled();
    });
});
