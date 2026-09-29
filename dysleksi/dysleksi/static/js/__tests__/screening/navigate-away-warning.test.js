/**
 * @vitest-environment jsdom
 */
import { vi, describe, it, expect } from "vitest";
import { NavigateAwayWarning } from "../../screening/controlroom.js";

describe("NavigateAwayWarning", () => {
    it("intercepts navigation if toggled on", () => {
        const instance = new NavigateAwayWarning();
        const spyHandle = vi.spyOn(instance, "handle");
        instance.toggle(true);
        global.window.dispatchEvent(new Event("beforeunload"));
        expect(spyHandle).toBeCalled();
    });

    it("does not intercept navigation if toggled off", () => {
        const instance = new NavigateAwayWarning();
        const spyHandle = vi.spyOn(instance, "handle");
        instance.toggle(false);
        global.window.dispatchEvent(new Event("beforeunload"));
        expect(spyHandle).not.toBeCalled();
    });
});
