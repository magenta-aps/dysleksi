/**
 * @vitest-environment jsdom
 */
import { GroupTestDomElements, IndividualTestDomElements } from "../../screening/dom.js";
import { describe, it, expect, beforeEach, vi } from "vitest";


describe("GroupTestDomElements.showInstructions (sound only)", () => {
    let dom;

    beforeEach(() => {
        document.body.innerHTML = `
      <audio id="instructions-sound"></audio>
      <audio id="reminder-sound"></audio>
      <div id="instructions-text"></div>
      <button id="start-practice"></button>
      <button id="start-questions"></button>
      <table id="summary-table"></table>
      <button id="end-summary"></button>
      <div id="question-title"></div>
      <div id="question-challenge"></div>
      <div id="choices"></div>
      <button id="next"></button>
    `;

        dom = new GroupTestDomElements();
        vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => {
        });
    });

    it("creates audio element and play button", () => {
        dom.showInstructions(null, "/sound.mp3");
        expect(dom.instructionsSoundEl.childNodes.length, 1);
        const sourceNode = dom.instructionsSoundEl.childNodes[0];
        expect(sourceNode).not.toBeNull();
        expect(sourceNode.nodeName, "AUDIO");
        expect(sourceNode.src).toContain("/sound.mp3");
        expect(sourceNode.type).toBe("audio/mpeg");
    });
});


describe("GroupTestDomElements.showQuestionChallenge (sound only)", () => {
  let dom;

  beforeEach(() => {
    document.body.innerHTML = `
      <audio id="instructions-sound"></audio>
      <audio id="reminder-sound"></audio>
      <div id="instructions-text"></div>
      <button id="start-practice"></button>
      <button id="start-questions"></button>
      <table id="summary-table"></table>
      <button id="end-summary"></button>
      <div id="question-title"></div>
      <div id="question-challenge"></div>
      <div id="choices"></div>
      <button id="next"></button>
    `;

    dom = new GroupTestDomElements();

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


describe("GroupTestDomElements.showSummary (text only)", () => {
    let dom;

    beforeEach(() => {
        document.body.innerHTML = `
      <audio id="instructions-sound"></audio>
      <audio id="reminder-sound"></audio>
      <div id="instructions-text"></div>
      <button id="start-practice"></button>
      <button id="start-questions"></button>
      <table id="summary-table"></table>
      <button id="end-summary"></button>
      <div id="question-title"></div>
      <div id="question-challenge"></div>
      <div id="choices"></div>
      <button id="next"></button>
      <div id="test-summary"> </div>
    `;

        dom = new GroupTestDomElements();

        vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => {});
    });

    it("Shows summary", () => {
        dom.showSummary(["1", "2", "3"]);
        expect(dom.summaryTable.outerHTML).toBe(
            '<table id="summary-table">' +
            '<tr><td>1</td></tr>' +
            '<tr><td>2</td></tr>' +
            '<tr><td>3</td></tr>' +
            '</table>'
        );
    });
});

describe("GroupTestDomElements.showQuestionChallenge (text only)", () => {
    let dom;

    beforeEach(() => {
        document.body.innerHTML = `
      <audio id="instructions-sound"></audio>
      <audio id="reminder-sound"></audio>
      <div id="instructions-text"></div>
      <button id="start-practice"></button>
      <button id="start-questions"></button>
      <table id="summary-table"></table>
      <button id="end-summary"></button>
      <div id="question-title"></div>
      <div id="question-challenge"></div>
      <div id="choices"></div>
      <button id="next"></button>
    `;

        dom = new GroupTestDomElements();

        vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => {});
    });

    it("Shows question challenge text", () => {
        dom.showQuestionChallenge("Testtekst", null, null);

        const audio = document.querySelector("#challenge-audio");
        const playBtn = document.querySelector("#challenge-sound-btn");
        const image = document.querySelector("#challenge-image");
        const text = document.querySelector("#challenge-text");

        expect(audio).toBeNull();
        expect(playBtn).toBeNull();
        expect(image).toBeNull();
        expect(text).not.toBeNull();
        expect(text.textContent).toBe("Testtekst");

        dom.showQuestionChallenge(null, null, "option1.png");
        const text2 = document.querySelector("#challenge-text");
        expect(text2).toBeNull();
    });

    it("Shows question choices", () => {
        vi.spyOn(HTMLElement.prototype, "addEventListener").mockImplementation(() => {});
        const listener = () => {};

        const button1 = dom.showQuestionChoice(null, null, "option1.png", null);
        expect(button1.textContent).toBe("");
        expect(button1.addEventListener).not.toHaveBeenCalled();
        const image = button1.firstChild;
        expect(image).not.toBeNull();
        expect(image.src).toContain("option1.png");

        const button2 = dom.showQuestionChoice("Option A", null, null, listener);
        expect(button2.textContent).toBe("Option A");
        expect(button2.addEventListener).toHaveBeenCalledWith("click", listener);

    })
});


describe("GroupTestDomElements constructor", () => {
    it("creates elements", () => {
        document.body.innerHTML = `
      <audio id="instructions-sound"></audio>
      <audio id="reminder-sound"></audio>
      <div id="instructions-text"></div>
      <button id="start-practice"></button>
      <button id="start-questions"></button>
      <table id="summary-table"></table>
      <button id="end-summary"></button>
      <div id="question-title"></div>
      <div id="question-challenge"></div>
      <div id="choices"></div>
      <button id="next"></button>
    `;
        const dom = new GroupTestDomElements();
        expect(dom.startPracticeButton).not.toBeNull();
        expect(dom.startQuestionsButton).not.toBeNull();
        expect(dom.choicesEl).not.toBeNull();
        expect(dom.nextBtn).not.toBeNull();
    });

})

describe("IndividualTestDomElements constructor", () => {
    it("creates elements", () => {
        document.body.innerHTML = `
      <div id="audio-indicator" style="display: none"></div>
      <audio id="instructions-sound"></audio>
      <div id="instructions-text"></div>
      <table id="summary-table"></table>
      <button id="end-summary"></button>
      <div id="question-title"></div>
      <div id="question-challenge"></div>
    `;
        const dom = new IndividualTestDomElements();
        expect(dom.startPracticeButton).not.toBeNull();
        expect(dom.startQuestionsButton).not.toBeNull();
        expect(dom.choicesEl).not.toBeNull();
        expect(dom.nextBtn).not.toBeNull();
        expect(dom.audioIndicatorEl).not.toBeNull();
    });
})

describe("IndividualTestDomElements DOM utilities", () => {
    let dom;
    beforeEach(() => {
        document.body.innerHTML = `
      <div id="audio-indicator" style="display: none"></div>
      <audio id="instructions-sound"></audio>
      <div id="instructions-text"></div>
      <table id="summary-table"></table>
      <button id="end-summary"></button>
      <div id="question-title"></div>
      <div id="question-challenge"></div>
    `;
        dom = new IndividualTestDomElements();
    });
    it("show audio indicator", () => {
        dom.toggleAudioIndicator(true);
        expect(dom.audioIndicatorEl.style.display).toBe("block");
    });
    it("hide audio indicator", () => {
        dom.toggleAudioIndicator(true);
        dom.toggleAudioIndicator(false);
        expect(dom.audioIndicatorEl.style.display).toBe("none");
    });
})



describe("GroupTestDomElements DOM utilities", () => {
  let dom;
  let el;

  beforeEach(() => {
    document.body.innerHTML = `
      <audio id="instructions-sound"></audio>
      <audio id="reminder-sound"></audio>
      <div id="instructions-text"></div>
      <button id="start-practice"></button>
      <button id="start-questions"></button>
      <table id="summary-table"></table>
      <button id="end-summary"></button>
      <div id="question-title"></div>
      <div id="question-challenge"></div>
      <div id="choices"></div>
      <button id="next"></button>
      <div id="test-el"></div>
    `;
    dom = new GroupTestDomElements();
    el = document.getElementById("test-el");
  });

  it("showElement sets visibility to visible", () => {
    dom.showElement(el);
    expect(el.style.visibility).toBe("visible");
  });

  it("hideElement sets visibility to none", () => {
    dom.hideElement(el);
    expect(el.style.visibility).toBe("hidden");
  });

  it("fadeIn sets opacity to 1", async () => {
    el.style.opacity = "0.4";

    await new Promise(resolve => requestAnimationFrame(resolve));
    dom.fadeIn(el);
    await new Promise(resolve => requestAnimationFrame(resolve));

    expect(el.style.opacity).toBe("1");
    expect(el.style.transition).toContain("opacity");
  });

  it("fadeOut sets opacity to 0.4", async () => {
    el.style.opacity = "1";

    await new Promise(resolve => requestAnimationFrame(resolve));
    dom.fadeOut(el);
    await new Promise(resolve => requestAnimationFrame(resolve));

    expect(el.style.opacity).toBe("0.4");
    expect(el.style.transition).toContain("opacity");
  });

  it("highlight adds highlight class temporarily", async () => {
    vi.useFakeTimers();
    dom.highlight(el);
    expect(el.classList.contains("highlight")).toBe(true);
    vi.advanceTimersByTime(1500);
    expect(el.classList.contains("highlight")).toBe(false);
    vi.useRealTimers();
  });

  it("lockInput disables all choice buttons and next button", () => {
    const btn1 = document.createElement("button");
    const btn2 = document.createElement("button");
    document.getElementById("choices").append(btn1, btn2);
    const nextBtn = document.getElementById("next");

    dom.lockInput();

    expect(btn1.disabled).toBe(true);
    expect(btn2.disabled).toBe(true);
    expect(nextBtn.disabled).toBe(true);
  });

  it("unlockInput enables all choice buttons and next button", () => {
    const btn1 = document.createElement("button");
    const btn2 = document.createElement("button");
    document.getElementById("choices").append(btn1, btn2);
    const nextBtn = document.getElementById("next");

    dom.lockInput(); // first lock
    dom.unlockInput();

    expect(btn1.disabled).toBe(false);
    expect(btn2.disabled).toBe(false);
    expect(nextBtn.disabled).toBe(false);
  });
});


describe("GroupTestDomElements.fadeScreenOverlay", () => {
  let dom;
  let overlay;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="fade-overlay" style="opacity: 0;"></div>
      <audio id="instructions-sound"></audio>
      <audio id="reminder-sound"></audio>
      <div id="instructions-text"></div>
      <button id="start-practice"></button>
      <button id="start-questions"></button>
      <table id="summary-table"></table>
      <button id="end-summary"></button>
      <div id="question-title"></div>
      <div id="question-challenge"></div>
      <div id="choices"></div>
      <button id="next"></button>
      <div id="test-el"></div>
    `;
    dom = new GroupTestDomElements();
    overlay = document.getElementById("fade-overlay");
  });

  it("fades overlay from opaque to transparent", () => {
    vi.useFakeTimers();

    vi.stubGlobal("requestAnimationFrame", (cb) => cb());
    dom.fadeScreenOverlay();

    expect(overlay.style.opacity).toBe("1");
    expect(overlay.style.transition).toBe("none");

    vi.advanceTimersByTime(200);

    expect(overlay.style.opacity).toBe("0");
    expect(overlay.style.transition).toBe("opacity 200ms ease");

    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});


describe("_setButtonListener tests", () => {
  let dom;
  let button;

  beforeEach(() => {
    document.body.innerHTML = `
      <audio id="instructions-sound"></audio>
      <audio id="reminder-sound"></audio>
      <div id="instructions-text"></div>
      <button id="start-practice"></button>
      <button id="start-questions"></button>
      <table id="summary-table"></table>
      <button id="end-summary"></button>
      <div id="question-title"></div>
      <div id="question-challenge"></div>
      <div id="choices"></div>
      <button id="next"></button>
    `;

    dom = new GroupTestDomElements();
    button = document.createElement("button");
    document.body.appendChild(button);
  });

  it("adds a click listener", () => {
    const listener = vi.fn();
    const spy = vi.spyOn(button, "addEventListener");

    dom._setButtonListener(button, listener);

    expect(spy).toHaveBeenCalledWith("click", listener);
    expect(button._clickHandler).toBe(listener);
  });

  it("removes the old listener when replaced", () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    const removeSpy = vi.spyOn(button, "removeEventListener");
    const addSpy = vi.spyOn(button, "addEventListener");

    dom._setButtonListener(button, listener1);
    dom._setButtonListener(button, listener2);

    expect(removeSpy).toHaveBeenCalledWith("click", listener1);
    expect(addSpy).toHaveBeenCalledWith("click", listener2);
    expect(button._clickHandler).toBe(listener2);
  });
});
