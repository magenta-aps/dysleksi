/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { gettext, blocktranslate } from "../i18n.js";

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("gettext", () => {
    it("returns the source string when no catalog is loaded", () => {
        vi.stubGlobal("gettext", undefined);

        expect(gettext("Udvikler")).toBe("Udvikler");
    });

    it("delegates to the Django catalog gettext when available", () => {
        const catalogGettext = vi.fn(() => "Developer");
        vi.stubGlobal("gettext", catalogGettext);

        expect(gettext("Udvikler")).toBe("Developer");
        expect(catalogGettext).toHaveBeenCalledWith("Udvikler");
    });
});

describe("blocktranslate", () => {
    const params = { name: "Fred" };
    it("interpolates a named placeholder when no catalog is loaded", () => {
        vi.stubGlobal("interpolate", undefined);

        expect(blocktranslate("Mit navn er %(name)s", params)).toBe("Mit navn er Fred");
    });

    it("delegates to the Django catalog interpolate with named=true when available", () => {
        const catalogInterpolate = vi.fn(() => "My name is Fred");
        vi.stubGlobal("interpolate", catalogInterpolate);

        expect(blocktranslate("Mit navn er %(name)s", params)).toBe("My name is Fred");
    });
});
