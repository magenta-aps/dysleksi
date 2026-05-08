/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { AssetCache } from "../../screening/cache.js";

describe("AssetCache", () => {
    let cache;
    const mockBlobUrl = "blob:http://localhost/1234-5678";
    const mockUrl = "/static/test-image.png";

    beforeEach(() => {
        cache = new AssetCache();

        global.fetch = vi.fn().mockResolvedValue({
            blob: vi.fn().mockResolvedValue(new Blob(["test"], { type: "image/png" })),
        });

        global.URL.createObjectURL = vi.fn().mockReturnValue(mockBlobUrl);

        global.FontFace = vi
            .fn()
            .mockImplementation(function (name, source, descriptors) {
                this.name = name;
                this.source = source;
                this.descriptors = descriptors;
                this.load = vi.fn().mockResolvedValue(this);
            });

        Object.defineProperty(document, "fonts", {
            value: { add: vi.fn() },
            configurable: true,
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("fetch and reverseFetch", () => {
        it("returns the original URL if not cached", () => {
            expect(cache.fetch("not-cached.png")).toBe("not-cached.png");
        });

        it("returns the cached blob URL if available", () => {
            cache.map.set(mockUrl, mockBlobUrl);
            expect(cache.fetch(mockUrl)).toBe(mockBlobUrl);
        });

        it("reverseFetch returns the original URL given a blob URL", () => {
            cache.map.set("foo", "bar");
            cache.map.set(mockUrl, mockBlobUrl);
            expect(cache.reverseFetch(mockBlobUrl)).toBe(mockUrl);
        });

        it("reverseFetch returns the input if no mapping exists", () => {
            expect(cache.reverseFetch("random-string")).toBe("random-string");
        });
    });

    describe("fetchAndCache", () => {
        it("fetches, stores, and returns a blob URL", async () => {
            const result = await cache.fetchAndCache(mockUrl);

            expect(global.fetch).toHaveBeenCalledWith(mockUrl);
            expect(cache.map.get(mockUrl)).toBe(mockBlobUrl);
            expect(result).toBe(mockBlobUrl);
        });

        it("does not fetch twice for the same URL", async () => {
            await cache.fetchAndCache(mockUrl);
            await cache.fetchAndCache(mockUrl);

            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        it("is called through processStaticFile", async () => {
            await cache.processStaticFile(mockUrl);

            expect(global.fetch).toHaveBeenCalledWith(mockUrl);
            expect(cache.map.get(mockUrl)).toBe(mockBlobUrl);
        });
    });

    describe("processTestObject", () => {
        it("overwrites the object key with the blob URL", async () => {
            const testObj = { image: "original.png" };
            await cache.processTestObject(testObj, "image");

            expect(testObj.image).toBe(mockBlobUrl);
        });

        it("does nothing if the key is missing", async () => {
            const testObj = { image: null };
            await cache.processTestObject(testObj, "image");
            expect(testObj.image).toBeNull();
        });
    });

    describe("applyCssVariables", () => {
        let mockStyle;
        let mockStyle2;
        let mockStyle3;
        let setPropertySpy;

        beforeEach(() => {
            mockStyle = {
                "--bg-image": 'url("/static/bg.png")',
                getPropertyValue: (name) =>
                    name === "--bg-image" ? 'url("/static/bg.png")' : "",
                0: "--bg-image",
                length: 1,
                [Symbol.iterator]: function* () {
                    yield "--bg-image";
                },
            };

            mockStyle2 = {
                "--some-other-var": "foo.png",
                getPropertyValue: (name) =>
                    name === "--some-other-var" ? "foo.png" : "",
                0: "--some-other-var",
                length: 1,
                [Symbol.iterator]: function* () {
                    yield "--some-other-var";
                },
            };

            mockStyle3 = {
                "some-other-var": "foo.png",
                getPropertyValue: (name) =>
                    name === "some-other-var" ? "foo.png" : "",
                0: "some-other-var",
                length: 1,
                [Symbol.iterator]: function* () {
                    yield "some-other-var";
                },
            };

            const mockSheet = {
                cssRules: [
                    {
                        selectorText: ":root",
                        style: mockStyle,
                    },
                    {
                        selectorText: ":root",
                        style: mockStyle2,
                    },
                    {
                        selectorText: ":not_root",
                        style: mockStyle2,
                    },
                    {
                        selectorText: ":root",
                        style: mockStyle3,
                    },
                ],
            };

            Object.defineProperty(document, "styleSheets", {
                value: [mockSheet],
                configurable: true,
            });

            vi.spyOn(window, "getComputedStyle").mockReturnValue({
                getPropertyValue: (prop) => mockStyle.getPropertyValue(prop),
            });

            setPropertySpy = vi.spyOn(document.documentElement.style, "setProperty");
        });

        it("updates :root CSS variables with cached blobs", () => {
            cache.map.set("/static/bg.png", mockBlobUrl);

            cache.applyCssVariables();

            expect(setPropertySpy).toHaveBeenCalledWith(
                "--bg-image",
                `url(${mockBlobUrl})`,
            );
            expect(setPropertySpy).not.toHaveBeenCalledWith(
                "--plain-color",
                expect.any(String),
            );
            expect(setPropertySpy).not.toHaveBeenCalledWith(
                "background-image",
                expect.any(String),
            );
            expect(setPropertySpy).toHaveBeenCalledTimes(1);
        });

        it("updates CSS variables if filename contains hash", () => {
            cache.map.set("/static/bg.6eca11d940e6.png", mockBlobUrl);

            cache.applyCssVariables();

            expect(setPropertySpy).toHaveBeenCalledWith(
                "--bg-image",
                `url(${mockBlobUrl})`,
            );
        });

        it("Raise warning if CSS variable is not in map", () => {
            cache.map.set("/static/bg2.png", mockBlobUrl);

            const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
            cache.applyCssVariables();
            expect(setPropertySpy).toHaveBeenCalledTimes(0);

            // We expect the code to complain that bg.png is not present in the map
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining("bg.png"),
                expect.any(Map),
            );
        });
    });

    describe("applyCachedFonts", () => {
        it("loads and adds .ttf files to document.fonts", async () => {
            cache.map.set("/some/other/path/foo.png", "blob-url");
            cache.map.set("/fonts/OpenSans-Bold.ttf", mockBlobUrl);
            cache.map.set("/fonts/OpenSans-Italic.ttf", mockBlobUrl);

            await cache.applyCachedFonts();

            expect(global.FontFace).toHaveBeenCalledWith(
                "OpenSans-Bold",
                `url(${mockBlobUrl})`,
                expect.objectContaining({ weight: "700" }),
            );

            expect(global.FontFace).toHaveBeenCalledWith(
                "OpenSans-Italic",
                `url(${mockBlobUrl})`,
                expect.objectContaining({ weight: "400" }),
            );

            expect(document.fonts.add).toHaveBeenCalled();
        });
    });

    describe("stripHash", () => {
        it("strips hashes", async () => {
            const strippedPath = cache._stripHash("/static/file.6eca11d940e6.png");
            const strippedPath2 = cache._stripHash("/static/file.png");
            const strippedPath3 = cache._stripHash("/static/1a.2.wav");
            const strippedPath4 = cache._stripHash("/static/1a.2.c2ecd49d10b7.wav");

            expect(strippedPath).toBe("/static/file.png");
            expect(strippedPath2).toBe("/static/file.png");
            expect(strippedPath3).toBe("/static/1a.2.wav");
            expect(strippedPath4).toBe("/static/1a.2.wav");
        });
    });
});
