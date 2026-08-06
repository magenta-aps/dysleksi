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
        initialize_audio_players(document);
        expect(audioListenerSpy).toHaveBeenCalledWith("canplay", expect.any(Function));
        audioEl.dispatchEvent(new Event("canplay"));
        expect(buttonListenerSpy).toHaveBeenCalledWith("click", expect.any(Function));
        expect(durationEl.textContent).not.toBe("--:--");
    });

    it("add listeners ready", () => {
        audioEl.readyState = 4;
        initialize_audio_players(document);
        expect(audioListenerSpy).not.toHaveBeenCalledWith(
            "canplay",
            expect.any(Function),
        );
        expect(buttonListenerSpy).toHaveBeenCalledWith("click", expect.any(Function));
        expect(durationEl.textContent).toBe("--:--");
    });

    it("click play", () => {
        initialize_audio_players(document);
        audioEl.dispatchEvent(new Event("canplay"));
        playBtnEl.dispatchEvent(new Event("click"));
        expect(audioPlaySpy).toHaveBeenCalled();
        expect(player.classList).toContain("playing");
        expect(durationEl.textContent).toBe("--:--");
    });

    it("end play", () => {
        initialize_audio_players(document);
        audioEl.dispatchEvent(new Event("canplay"));
        playBtnEl.dispatchEvent(new Event("click"));
        audioEl.dispatchEvent(new Event("ended"));
        expect(audioPlaySpy).toHaveBeenCalled();
        expect(player.classList).not.toContain("playing");
        expect(durationEl.textContent).toBe("--:--");
    });

    it("stops other players when a new one is clicked", () => {
        document.body.innerHTML = `
            <div class="audio"><audio></audio><i></i><span></span></div>
            <div class="audio"><audio></audio><i></i><span></span></div>
        `;

        const players = document.getElementsByClassName("audio");
        const first = players[0];
        const second = players[1];
        const firstAudio = first.getElementsByTagName("audio")[0];
        const secondAudio = second.getElementsByTagName("audio")[0];
        firstAudio.readyState = 4;
        secondAudio.readyState = 4;

        // `currentTime` is not implemented in jsdom, so make it a plain
        // writable property on both audio elements.
        Object.defineProperty(firstAudio, "currentTime", {
            writable: true,
            value: 0,
        });
        Object.defineProperty(secondAudio, "currentTime", {
            writable: true,
            value: 0,
        });

        const firstPauseSpy = vi.spyOn(firstAudio, "pause");
        vi.spyOn(secondAudio, "pause");
        vi.spyOn(firstAudio, "play");
        vi.spyOn(secondAudio, "play");

        initialize_audio_players(document);

        // A `.audio` container without an `<audio>` element must be skipped
        // gracefully by `stopOtherAudioPlayers`. It is added after
        // initialization so it does not need its own player wiring.
        document.body.insertAdjacentHTML(
            "beforeend",
            `<div class="audio"><i></i><span></span></div>`,
        );

        // Play the first player and pretend it has progressed.
        first.getElementsByTagName("i")[0].dispatchEvent(new Event("click"));
        expect(first.classList).toContain("playing");
        firstAudio.currentTime = 5;

        // Clicking the second player must interrupt the first one.
        second.getElementsByTagName("i")[0].dispatchEvent(new Event("click"));

        expect(firstPauseSpy).toHaveBeenCalled();
        expect(firstAudio.currentTime).toBe(0);
        expect(first.classList).not.toContain("playing");
        expect(second.classList).toContain("playing");
    });

    it("show duration when loaded", () => {
        audioEl.readyState = 1;
        audioEl.duration = 72;
        initialize_audio_players(document);
        expect(durationEl.textContent).toBe("01:12");
    });

    it("show duration when not loaded", () => {
        audioEl.readyState = 0;
        audioEl.duration = 83;
        initialize_audio_players(document);
        expect(durationEl.textContent).toBe("");
        audioEl.dispatchEvent(new Event("loadedmetadata"));
        expect(durationEl.textContent).toBe("01:23");
    });
});
