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


describe("GroupTestDomElements.showSummary (new structure)", () => {
    let dom;

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="test-summary" style="display: none">
                <div class="center-content">
                    <div id="summary-container"></div>
                </div>
            </div>
        `;

        dom = new GroupTestDomElements();

        // Spy on console.log to suppress output during tests
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("Shows test summary with multiple parts", () => {
        const test = {
            parts: [
                { name: "Ordlæsning", questions: [1, 2], image: "/static/ol.png" },
                { name: "Ordstavning", questions: [1], image: "/static/os.png" } ,
                { name: "Bogstavbenævnelse", questions: [1, 2, 3], image: "/static/bb.png" }
            ]
        };
    
        dom.showSummary(test);
    
        expect(dom.testSummary.style.display).toBe("flex");
    
        const blocks = dom.summaryContainer.querySelectorAll(".summary-block");
        expect(blocks.length).toBe(3);
    
        // Check first block
        const firstBlock = blocks[0];
        expect(firstBlock.querySelector("strong").textContent).toBe("Deltest 1: ");
        expect(firstBlock.childNodes[0].childNodes[1].textContent.trim()).toBe("Ordlæsning"); // the text node with part name
        expect(firstBlock.childNodes[1].src.endsWith("/static/ol.png")).toBe(true);

        // Second block
        const secondBlock = blocks[1];
        expect(secondBlock.querySelector("strong").textContent).toBe("Deltest 2: ");
        expect(secondBlock.childNodes[0].childNodes[1].textContent.trim()).toBe("Ordstavning");
        expect(secondBlock.childNodes[1].src.endsWith("/static/os.png")).toBe(true);

        // Third block
        const thirdBlock = blocks[2];
        expect(thirdBlock.querySelector("strong").textContent).toBe("Deltest 3: ");
        expect(thirdBlock.childNodes[0].childNodes[1].textContent.trim()).toBe("Bogstavbenævnelse");
        expect(thirdBlock.childNodes[1].src.endsWith("/static/bb.png")).toBe(true);

    });

    it("Handles an empty parts array", () => {
        const test = { parts: [] };
        dom.showSummary(test);

        expect(dom.testSummary.style.display).toBe("flex");
        expect(dom.summaryContainer.children.length).toBe(0);
    });

    it("Handles a single part with no questions", () => {
        const test = { parts: [{ name: "Bogstavbenævnelse", questions: [] }] };
        dom.showSummary(test);
    
        const block = dom.summaryContainer.querySelector(".summary-block");
        expect(block).not.toBeNull();
        expect(block.querySelector("strong").textContent).toBe("Deltest 1: ");
        expect(block.childNodes[0].childNodes[1].textContent.trim()).toBe("Bogstavbenævnelse");
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

        const answer1 = {
            resourceText: "",
            resourceSoundUrl: null,
            resourceImageUrl: "option1.png",
            buttonId: "btn1",
        };

        const answer2 = {
            resourceText: "Option A",
            resourceSoundUrl: null,
            resourceImageUrl: null,
            buttonId: "btn2",
        };

        const button1 = dom.showQuestionChoice(answer1, null);
        expect(button1.textContent).toBe("");
        expect(button1.addEventListener).not.toHaveBeenCalled();
        const image = button1.firstChild;
        expect(image).not.toBeNull();
        expect(image.src).toContain("option1.png");

        const button2 = dom.showQuestionChoice(answer2, listener);
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

    expect(btn1.style.pointerEvents).toBe("none");
    expect(btn2.style.pointerEvents).toBe("none");
    expect(nextBtn.style.pointerEvents).toBe("none");
  });

  it("unlockInput enables all choice buttons and next button", () => {
    const btn1 = document.createElement("button");
    const btn2 = document.createElement("button");
    document.getElementById("choices").append(btn1, btn2);
    const nextBtn = document.getElementById("next");

    dom.lockInput(); // first lock
    dom.unlockInput();

    expect(btn1.style.pointerEvents).toBe("");
    expect(btn2.style.pointerEvents).toBe("");
    expect(nextBtn.style.pointerEvents).toBe("");
  });

  it("disableNextButton/enableNextButton disable and enable next button", async () => {
    const nextBtn = document.getElementById("next");

    dom.disableNextButton();
    expect(nextBtn.disabled).toBe(true);

    dom.enableNextButton();
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


describe("GroupTestDomElements button animations", () => {
  let dom;
  let btn;

  beforeEach(() => {
    document.body.innerHTML = `<button id="test-btn"></button>`;
    dom = new GroupTestDomElements();
    btn = document.getElementById("test-btn");
  });

  it("makeButtonHappy adds and removes happy-btn class", () => {
    vi.useFakeTimers();

    const addSpy = vi.spyOn(btn.classList, "add");
    const removeSpy = vi.spyOn(btn.classList, "remove");

    dom.makeButtonHappy("test-btn");

    expect(removeSpy).toHaveBeenCalledWith("happy-btn");
    expect(addSpy).toHaveBeenCalledWith("happy-btn");

    vi.advanceTimersByTime(650);

    expect(removeSpy).toHaveBeenCalledWith("happy-btn");
    vi.useRealTimers();
  });

  it("makeButtonAngry adds and removes angry-btn class", () => {
    vi.useFakeTimers();

    const addSpy = vi.spyOn(btn.classList, "add");
    const removeSpy = vi.spyOn(btn.classList, "remove");

    dom.makeButtonAngry("test-btn");

    expect(removeSpy).toHaveBeenCalledWith("angry-btn");
    expect(addSpy).toHaveBeenCalledWith("angry-btn");

    vi.advanceTimersByTime(650);

    expect(removeSpy).toHaveBeenCalledWith("angry-btn");

    vi.useRealTimers();
  });
});
