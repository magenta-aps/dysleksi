/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initialize_audio_players } from "../../admin/audioplayer.js";

const mockDoc = `
    <div class="audio">
    <audio></audio>
    <i></i>
    <span></span>
</div>
`;

describe("Audioplayer", () => {
    let player;
    let audioEl;
    let playBtnEl;
    let durationEl;

    const originalDuration = Object.getOwnPropertyDescriptor(
        HTMLMediaElement.prototype,
        "duration",
    );
    const originalReadyState = Object.getOwnPropertyDescriptor(
        HTMLMediaElement.prototype,
        "readyState",
    );

    let audioListenerSpy;
    let buttonListenerSpy;
    let audioPlaySpy;

    beforeEach(() => {
        document.body.innerHTML = mockDoc;

        player = document.getElementsByClassName("audio")[0];
        audioEl = player.getElementsByTagName("audio")[0];
        playBtnEl = player.getElementsByTagName("i")[0];
        durationEl = player.getElementsByTagName("span")[0];

        audioListenerSpy = vi.spyOn(audioEl, "addEventListener");
        buttonListenerSpy = vi.spyOn(playBtnEl, "addEventListener");
        audioPlaySpy = vi.spyOn(audioEl, "play");

        Object.defineProperty(HTMLMediaElement.prototype, "duration", {
            configurable: true,
            get() {
                return this._duration;
            },
            set(value) {
                this._duration = value;
            },
        });

        Object.defineProperty(HTMLMediaElement.prototype, "readyState", {
            configurable: true,
            get() {
                return this._readyState;
            },
            set(value) {
                this._readyState = value;
            },
        });
    });

    afterEach(() => {
        // Restore original getter after each test
        if (originalReadyState) {
            Object.defineProperty(
                HTMLMediaElement.prototype,
                "duration",
                originalDuration,
            );
        }
        if (originalReadyState) {
            Object.defineProperty(
                HTMLMediaElement.prototype,
                "readyState",
                originalReadyState,
            );
        }
    });

    it("add listeners", () => {
        initialize_audio_players();
        expect(audioListenerSpy).toHaveBeenCalledWith("canplay", expect.any(Function));
        audioEl.dispatchEvent(new Event("canplay"));
        expect(buttonListenerSpy).toHaveBeenCalledWith("click", expect.any(Function));
        expect(durationEl.textContent).not.toBe("--:--");
    });

    it("add listeners ready", () => {
        audioEl.readyState = 4;
        initialize_audio_players();
        expect(audioListenerSpy).not.toHaveBeenCalledWith(
            "canplay",
            expect.any(Function),
        );
        expect(buttonListenerSpy).toHaveBeenCalledWith("click", expect.any(Function));
        expect(durationEl.textContent).toBe("--:--");
    });

    it("click play", () => {
        initialize_audio_players();
        audioEl.dispatchEvent(new Event("canplay"));
        playBtnEl.dispatchEvent(new Event("click"));
        expect(audioPlaySpy).toHaveBeenCalled();
        expect(player.classList).toContain("playing");
        expect(durationEl.textContent).toBe("--:--");
    });

    it("end play", () => {
        initialize_audio_players();
        audioEl.dispatchEvent(new Event("canplay"));
        playBtnEl.dispatchEvent(new Event("click"));
        audioEl.dispatchEvent(new Event("ended"));
        expect(audioPlaySpy).toHaveBeenCalled();
        expect(player.classList).not.toContain("playing");
        expect(durationEl.textContent).toBe("--:--");
    });

    it("show duration when loaded", () => {
        audioEl.readyState = 1;
        audioEl.duration = 72;
        initialize_audio_players();
        expect(durationEl.textContent).toBe("01:12");
    });

    it("show duration when not loaded", () => {
        audioEl.readyState = 0;
        audioEl.duration = 83;
        initialize_audio_players();
        expect(durationEl.textContent).toBe("");
        audioEl.dispatchEvent(new Event("loadedmetadata"));
        expect(durationEl.textContent).toBe("01:23");
    });
});
