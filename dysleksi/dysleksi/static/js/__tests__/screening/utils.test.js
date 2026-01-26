/**
 * @vitest-environment jsdom
 */
import { TestDomElements } from "../../screening/utils.js";
import { describe, it, expect, beforeEach, vi } from "vitest";

describe("TestDomElements.showQuestionChallenge (sound only)", () => {
  let dom;

  beforeEach(() => {
    document.body.innerHTML = `
      <audio id="instructions-sound"></audio>
      <div id="instructions-text"></div>
      <button id="start-practice"></button>
      <button id="start-questions"></button>
      <div id="question"></div>
      <div id="choices"></div>
      <button id="next"></button>
    `;

    dom = new TestDomElements();

    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => {});
  });

  it("creates audio element and play button", () => {
    dom.showQuestionChallenge(null, "/sound.mp3", null);
    const audio = document.querySelector("#challenge-audio");
    const playBtn = document.querySelector("#challenge-sound-btn");

    expect(audio).not.toBeNull();
    expect(audio.src).toContain("/sound.mp3");
    expect(playBtn).not.toBeNull();
  });

  it("plays audio when button clicked", () => {
    dom.showQuestionChallenge(null, "/sound.mp3", null);
    const audio = document.querySelector("#challenge-audio");
    const playBtn = document.querySelector("#challenge-sound-btn");

    audio.currentTime = 5;
    playBtn.click();

    expect(audio.currentTime).toBe(0);
    expect(audio.play).toHaveBeenCalledOnce();
  });

  it("removes audio and button when sound is null", () => {
    dom.showQuestionChallenge(null, "/sound.mp3", null);
    dom.showQuestionChallenge(null, null, null);

    expect(document.querySelector("#challenge-audio")).toBeNull();
    expect(document.querySelector("#challenge-sound-btn")).toBeNull();
  });
});
