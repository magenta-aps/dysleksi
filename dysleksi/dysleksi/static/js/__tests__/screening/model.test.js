/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Test } from "../../screening/model.js";
import { assetCache } from "../../screening/cache.js";

// Mock the assetCache methods used in preload
vi.mock("../../screening/cache.js", () => ({
    assetCache: {
        processStaticFile: vi.fn().mockResolvedValue(true),
        processTestObject: vi.fn().mockResolvedValue(true),
        applyCssVariables: vi.fn(),
        applyCachedFonts: vi.fn(),
        map: new Map([["test-url", "blob-url"]]),
    },
}));

describe("Test.preload", () => {
    let testInstance;
    const mockTestData = {
        name: "Preload Test",
        summary: "Testing assets",
        parts: [
            {
                id: 1,
                name: "Part 1",
                image: "part1.png",
                instructions_url: "inst.mp3",
                questions: [
                    {
                        id: 101,
                        challenge_image_url: "q1.png",
                        challenge_sound_url: "q1.mp3",
                        possible_answers: [
                            {
                                id: 1,
                                resource_image_url: "a1.png",
                                resource_sound_url: "a1.mp3",
                            },
                        ],
                        instruction_sequence: {
                            instructions: [{ url: "step1.mp3" }],
                        },
                    },
                    {
                        id: 102,
                        challenge_image_url: "q2.png",
                        challenge_sound_url: "q2.mp3",
                        possible_answers: [
                            {
                                id: 1,
                                resource_image_url: "a2.png",
                                resource_sound_url: "a2.mp3",
                            },
                        ],
                        instruction_sequence: {},
                    },
                ],
                practice: [],
            },
        ],
    };

    beforeEach(() => {
        document.body.innerHTML = `
            <script id="static_files" type="application/json">["/style.css", "/font.ttf"]</script>
            <button id="start-btn">Start</button>
        `;
        vi.clearAllMocks();
    });

    it("calls assetCache methods for all types of test content", async () => {
        testInstance = new Test(mockTestData);
        await testInstance.preload();

        expect(assetCache.processStaticFile).toHaveBeenCalledWith("/style.css");

        expect(assetCache.processTestObject).toHaveBeenCalledWith(
            expect.objectContaining({ name: "Part 1" }),
            "image",
        );

        expect(assetCache.processTestObject).toHaveBeenCalledWith(
            expect.objectContaining({ challengeImageUrl: "q1.png" }),
            "challengeImageUrl",
        );

        expect(assetCache.processTestObject).toHaveBeenCalledWith(
            expect.objectContaining({ resourceImageUrl: "a1.png" }),
            "resourceImageUrl",
        );
        expect(assetCache.applyCssVariables).toHaveBeenCalled();
        expect(assetCache.applyCachedFonts).toHaveBeenCalled();
    });
});
