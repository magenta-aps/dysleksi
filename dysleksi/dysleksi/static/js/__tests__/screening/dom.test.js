/**
 * @vitest-environment jsdom
 */
import {
    GroupTestDomElements,
    IndividualTestDomElements,
} from "../../screening/dom.js";
import { describe, it, expect, beforeEach, vi } from "vitest";
import * as utils from "../../screening/utils.js";

import { spyAttributes } from "../utils.js";

describe("GroupTestDomElements.showInstructions (sound only)", () => {
    let dom;

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
    `;

        dom = new GroupTestDomElements();
        vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => {});
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

    it("should NOT append a source element if audio is null", () => {
        // Call with text but NO audio
        dom.showInstructions("Read the text", null);

        // Assert that no source elements were added to the audio container
        expect(dom.instructionsSoundEl.childNodes.length).toBe(0);
    });
});

describe("GroupTestDomElements.showQuestionChallenge (sound only)", () => {
    let dom;

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
    `;

        dom = new GroupTestDomElements();

        vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => {});
    });

    it("removes audio and button when sound is null", () => {
        dom.showQuestionChallenge(null, "/sound.mp3", null);
        dom.showQuestionChallenge(null, null, null);

        expect(document.querySelector("#challenge-audio")).toBeNull();
        expect(document.querySelector("#challenge-sound-btn")).toBeNull();
    });
});

describe("GroupTestDomElements.showSummary", () => {
    let dom;

    // Helper to simulate scrolling in JSDOM
    const simulateScroll = (element, scrollTop) => {
        Object.defineProperty(element, "scrollTop", {
            value: scrollTop,
            configurable: true,
        });
        element.dispatchEvent(new Event("scroll"));
    };

    // Helper to set up the "physical" dimensions of the container
    const setDimensions = (element, { scrollHeight, clientHeight }) => {
        Object.defineProperty(element, "scrollHeight", {
            value: scrollHeight,
            configurable: true,
        });
        Object.defineProperty(element, "clientHeight", {
            value: clientHeight,
            configurable: true,
        });
    };

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="test-summary" style="display: none">
                <div class="center-content">
                    <div class="scroll-wrapper">
                        <div id="summary-container" class="summary-container"></div>
                        <div id="summary-scroll-controls" class="scroll-controls">
                            <div id="scroll-summary-up" class="scroll-arrow disabled">
                                <i class="ph-fill ph-arrow-up"></i>
                            </div>
                            <div id="scroll-summary-down" class="scroll-arrow">
                                <i class="ph-fill ph-arrow-down"></i>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
    `;

        dom = new GroupTestDomElements();
        Element.prototype.scrollBy = vi.fn();

        // Spy on console.log to suppress output during tests
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    it("Shows test summary with multiple parts", () => {
        const test = {
            parts: [
                { name: "Ordlæsning", questions: [1, 2], image: "/static/ol.png" },
                { name: "Ordstavning", questions: [1], image: "/static/os.png" },
                {
                    name: "Bogstavbenævnelse",
                    questions: [1, 2, 3],
                    image: "/static/bb.png",
                },
            ],
        };

        dom.showSummary(test.parts);

        expect(dom.testSummary.style.display).toBe("flex");

        const blocks = dom.summaryContainer.querySelectorAll(".summary-block");
        expect(blocks.length).toBe(3);

        // Check first block
        const firstBlock = blocks[0];
        expect(firstBlock.childNodes[0].childNodes[0].textContent.trim()).toBe(
            "Ordlæsning",
        ); // the text node with part name
        expect(firstBlock.childNodes[1].src.endsWith("/static/ol.png")).toBe(true);

        // Second block
        const secondBlock = blocks[1];
        expect(secondBlock.childNodes[0].childNodes[0].textContent.trim()).toBe(
            "Ordstavning",
        );
        expect(secondBlock.childNodes[1].src.endsWith("/static/os.png")).toBe(true);

        // Third block
        const thirdBlock = blocks[2];
        expect(thirdBlock.childNodes[0].childNodes[0].textContent.trim()).toBe(
            "Bogstavbenævnelse",
        );
        expect(thirdBlock.childNodes[1].src.endsWith("/static/bb.png")).toBe(true);
    });

    it("Handles an empty parts array", () => {
        const test = { parts: [] };
        dom.showSummary(test.parts);

        expect(dom.testSummary.style.display).toBe("flex");
        expect(dom.summaryContainer.children.length).toBe(0);
    });

    it("Handles a single part with no questions", () => {
        const test = { parts: [{ name: "Bogstavbenævnelse", questions: [] }] };
        dom.showSummary(test.parts);

        const block = dom.summaryContainer.querySelector(".summary-block");
        expect(block).not.toBeNull();
        expect(block.childNodes[0].childNodes[0].textContent.trim()).toBe(
            "Bogstavbenævnelse",
        );
    });

    it("Shows test summary with lots of parts and scroll-arrows", async () => {
        const test = {
            parts: [
                { name: "Part1", questions: [1], image: "/static/1.png" },
                { name: "Part2", questions: [1], image: "/static/2.png" },
                { name: "Part3", questions: [1], image: "/static/3.png" },
                { name: "Part4", questions: [1], image: "/static/4.png" },
                { name: "Part5", questions: [1], image: "/static/5.png" },
                { name: "Part6", questions: [1], image: "/static/6.png" },
            ],
        };

        setDimensions(dom.summaryContainer, { scrollHeight: 1000, clientHeight: 500 });
        simulateScroll(dom.summaryContainer, 0);

        dom.showSummary(test.parts);
        await new Promise((resolve) => setTimeout(resolve, 20));

        expect(dom.summaryScrollControls.style.display).toBe("flex");
        expect(dom.scrollSummaryUpArrow.classList.contains("disabled")).toBe(true);
        expect(dom.scrollSummaryDownArrow.classList.contains("disabled")).toBe(false);

        // Press the "scroll down" button
        dom.scrollSummaryDownArrow.click();
        simulateScroll(dom.summaryContainer, 100);

        expect(dom.scrollSummaryUpArrow.classList.contains("disabled")).toBe(false);
        expect(dom.scrollSummaryDownArrow.classList.contains("disabled")).toBe(false);

        // Scroll all the way down
        simulateScroll(dom.summaryContainer, 500);

        expect(dom.scrollSummaryUpArrow.classList.contains("disabled")).toBe(false);
        expect(dom.scrollSummaryDownArrow.classList.contains("disabled")).toBe(true);

        // Press the "scroll up" button
        dom.scrollSummaryUpArrow.click();
        simulateScroll(dom.summaryContainer, 400);

        expect(dom.scrollSummaryUpArrow.classList.contains("disabled")).toBe(false);
        expect(dom.scrollSummaryDownArrow.classList.contains("disabled")).toBe(false);
    });
});

describe("GroupTestDomElements.showQuestionChallenge (text only)", () => {
    let dom;

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
        vi.spyOn(HTMLElement.prototype, "addEventListener").mockImplementation(
            () => {},
        );
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
    });
});

describe("GroupTestDomElements constructor", () => {
    it("creates elements", () => {
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
    `;
        const dom = new GroupTestDomElements();
        expect(dom.startPracticeButton).not.toBeNull();
        expect(dom.startQuestionsButton).not.toBeNull();
        expect(dom.choicesEl).not.toBeNull();
        expect(dom.nextBtn).not.toBeNull();
    });
});

describe("IndividualTestDomElements constructor", () => {
    it("creates elements", () => {
        document.body.innerHTML = `
      <div id="fade-overlay" style="opacity: 0;"></div>
      <div id="audio-indicator" style="display: none"></div>
      <audio id="instructions-sound"></audio>
      <div id="instructions-text"></div>
      <table id="summary-table"></table>
      <button id="end-summary"></button>
      <button id="next"></button>
      <button id="repeat"></button>
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
});

describe("IndividualTestDomElements DOM utilities", () => {
    let dom;
    beforeEach(() => {
        document.body.innerHTML = `
      <div id="fade-overlay" style="opacity: 0;"></div>
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
});

describe("GroupTestDomElements DOM utilities", () => {
    let dom;
    let el;
    let el2;

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
      <button id="repeat" data-hide-display="true"></button>
      <button id="next"></button>
      <div id="test-el"></div>
      <div id="test-el2" data-hide-display="true"></div>
      <div id="testpart-intro-image" style="display: flex;"></div>
    `;
        dom = new GroupTestDomElements();
        el = document.getElementById("test-el");
        el2 = document.getElementById("test-el2");
    });

    it("hideTestPartIntroImage sets display to none", () => {
        dom.hideTestPartIntroImage();
        expect(dom.testPartIntroImage.style.display).toBe("none");
    });

    it("showFaded sets initial opacity and calls showElement after timeout", () => {
        vi.useFakeTimers();

        // Setup initial state
        el.style.opacity = "1";
        el.style.visibility = "hidden";

        // Spy on showElement to make sure it gets called
        const showSpy = vi.spyOn(dom, "showElement");

        dom.showFaded(el);

        // 1. Check immediate effects
        expect(el.style.transition).toBe("none");
        expect(el.style.opacity).toBe("0.4");

        // showElement shouldn't have been called yet
        expect(showSpy).not.toHaveBeenCalled();

        // 2. Advance timers to trigger the setTimeout(..., 1)
        vi.advanceTimersByTime(1);

        // 3. Check final effects
        expect(showSpy).toHaveBeenCalledWith(el);
        expect(el.style.visibility).toBe("visible");

        vi.useRealTimers();
    });

    it("showElement sets visibility to visible", () => {
        dom.showElement(el);
        expect(el.style.visibility).toBe("visible");
    });

    it("hideElement sets visibility to none", () => {
        dom.hideElement(el);
        expect(el.style.visibility).toBe("hidden");
    });
    it("hideElement with null arg does not break", () => {
        dom.hideElement(null);
    });

    it("showElement sets display to block", () => {
        dom.showElement(el2);
        expect(el2.style.display).toBe("block");
    });

    it("hideElement sets display to none", () => {
        dom.hideElement(el2);
        expect(el2.style.display).toBe("none");
    });
    it("showElement with null arg does not break", () => {
        dom.hideElement(null);
    });

    it("toggleRepeatButton hides button", () => {
        dom.toggleRepeatButton(false);
        expect(dom.repeatBtn.style.display).toBe("none");
    });
    it("toggleRepeatButton shows button", () => {
        dom.toggleRepeatButton(true);
        expect(dom.repeatBtn.style.display).toBe("block");
    });

    it("fadeIn sets opacity to 1", async () => {
        el.style.opacity = "0.4";

        await new Promise((resolve) => requestAnimationFrame(resolve));
        dom.fadeIn(el);
        await new Promise((resolve) => requestAnimationFrame(resolve));

        expect(el.style.opacity).toBe("1");
        expect(el.style.transition).toContain("opacity");
    });

    it("fadeOut sets opacity to 0.4", async () => {
        el.style.opacity = "1";

        await new Promise((resolve) => requestAnimationFrame(resolve));
        dom.fadeOut(el);
        await new Promise((resolve) => requestAnimationFrame(resolve));

        expect(el.style.opacity).toBe("0.4");
        expect(el.style.transition).toContain("opacity");
    });

    it("highlight adds highlight class temporarily", async () => {
        vi.useFakeTimers();
        dom.highlight(el);
        expect(el.classList.contains("highlight")).toBe(true);
        vi.advanceTimersByTime(2000);
        expect(el.classList.contains("highlight")).toBe(false);
        vi.useRealTimers();
    });

    it("lockInput disables all choice buttons and next button, and sets readonly on all inputs", () => {
        const btn1 = document.createElement("button");
        const btn2 = document.createElement("button");
        const input = document.createElement("input");
        document.getElementById("choices").append(btn1, btn2, input);
        const nextBtn = document.getElementById("next");

        dom.lockInput();

        expect(btn1.style.pointerEvents).toBe("none");
        expect(btn2.style.pointerEvents).toBe("none");
        expect(nextBtn.style.pointerEvents).toBe("none");
        expect(input.readOnly).toBe(true);
    });

    it("unlockInput enables all choice buttons and next button", () => {
        const btn1 = document.createElement("button");
        const btn2 = document.createElement("button");
        const input = document.createElement("input");
        document.getElementById("choices").append(btn1, btn2, input);
        const nextBtn = document.getElementById("next");

        dom.lockInput(); // first lock
        dom.unlockInput();

        expect(btn1.style.pointerEvents).toBe("");
        expect(btn2.style.pointerEvents).toBe("");
        expect(nextBtn.style.pointerEvents).toBe("");
        expect(input.readOnly).toBe(false);
    });

    it("disableNextButton/enableNextButton disable and enable next button", async () => {
        const nextBtn = document.getElementById("next");

        dom.disableNextButton();
        expect(nextBtn.disabled).toBe(true);

        dom.enableNextButton();
        expect(nextBtn.disabled).toBe(false);
    });

    it("setText inserts text into element", () => {
        const element = document.createElement("div");
        dom.setText(element, "test");
        expect(element.textContent).toBe("test");
    });
    it("setText inserts text into input element", () => {
        const element = document.createElement("input");
        dom.setText(element, "test");
        expect(element.value).toBe("test");
    });
    it("addText adds text to input element at position", () => {
        const input = document.createElement("input");
        document.body.appendChild(input);
        input.type = "text";
        input.value = "Test";
        dom.setMarker(input, 2);
        dom.addText(input, "123");
        expect(input.value).toBe("Te123st");
        expect(input.selectionStart).toBe(5);
    });

    it("removeText removes text from input element at position", () => {
        const input = document.createElement("input");
        document.body.appendChild(input);
        input.type = "text";
        input.value = "Test";
        dom.setMarker(input, 3);
        dom.removeText(input, 2);
        expect(input.value).toBe("Tt");
        expect(input.selectionStart).toBe(1);
    });

    it("removeText removes only text until start is reached", () => {
        const input = document.createElement("input");
        document.body.appendChild(input);
        input.type = "text";
        input.value = "Test";
        dom.setMarker(input, 3);
        dom.removeText(input, 4);
        expect(input.value).toBe("t");
        expect(input.selectionStart).toBe(0);
    });
    it("removeText defaults to one char", () => {
        const input = document.createElement("input");
        document.body.appendChild(input);
        input.type = "text";
        input.value = "Test";
        dom.setMarker(input, 3);
        dom.removeText(input);
        expect(input.value).toBe("Tet");
        expect(input.selectionStart).toBe(2);
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
        expect(overlay.style.transition).toBe("opacity 700ms ease");

        vi.useRealTimers();
        vi.unstubAllGlobals();
    });
});

describe("element ordering", () => {
    let dom;
    let container;
    let el0;
    let el1;
    let el2;
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
    `;

        dom = new GroupTestDomElements();
        spyAttributes(dom);
        container = dom.questionChallengeEl;

        el0 = document.createElement("div");
        el0.id = "test-el0";
        el1 = document.createElement("div");
        el1.id = "test-el1";
        el2 = document.createElement("div");
        el2.id = "test-el2";
    });

    it("insert element first", () => {
        dom._insert(container, el1, [], []);
        dom._insert(container, el2, [el1], []);
        dom._insert(container, el0, [], [el2, el1]);

        expect(container.childNodes.item(0)).toBe(el0);
        expect(container.childNodes.item(1)).toBe(el1);
        expect(container.childNodes.item(2)).toBe(el2);
    });

    it("insert element in the middle", () => {
        dom._insert(container, el0, [], []);
        dom._insert(container, el2, [el0], []);
        dom._insert(container, el1, [el0], [el2]);

        expect(container.childNodes.item(0)).toBe(el0);
        expect(container.childNodes.item(1)).toBe(el1);
        expect(container.childNodes.item(2)).toBe(el2);
    });

    it("insert element last", () => {
        dom._insert(container, el0, [], []);
        dom._insert(container, el1, [el0], []);
        dom._insert(container, el2, [el0, el1], []);

        expect(container.childNodes.item(0)).toBe(el0);
        expect(container.childNodes.item(1)).toBe(el1);
        expect(container.childNodes.item(2)).toBe(el2);
    });

    it("insert element without regard to order", () => {
        dom._insert(container, el0, [], []);
        dom._insert(container, el1, [], []);
        dom._insert(container, el2, [], []);

        expect(container.childNodes.item(0)).toBe(el0);
        expect(container.childNodes.item(1)).toBe(el1);
        expect(container.childNodes.item(2)).toBe(el2);
    });

    it("insert element with wrong surroundings", () => {
        const bsElement1 = document.createElement("div");
        const bsElement2 = document.createElement("div");

        dom._insert(container, el0, [], [bsElement1]);
        dom._insert(container, el1, [bsElement1], [bsElement2]);
        dom._insert(container, el2, [bsElement2], []);

        expect(container.childNodes.item(0)).toBe(el0);
        expect(container.childNodes.item(1)).toBe(el1);
        expect(container.childNodes.item(2)).toBe(el2);
    });
});

describe("_setButtonListener tests", () => {
    let dom;
    let button;

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
    `;

        dom = new GroupTestDomElements();
        spyAttributes(dom);
        button = document.createElement("button");
        document.body.appendChild(button);
    });

    it("adds a click listener", async () => {
        const listener = vi.fn();
        vi.spyOn(button, "addEventListener");
        dom._setButtonListener(button, listener);
        await button._clickHandler();
        expect(listener).toHaveBeenCalled();
    });

    it("removes the old listener when replaced", async () => {
        const listener1 = vi.fn();
        const listener2 = vi.fn();

        const addSpy = vi.spyOn(button, "addEventListener");

        dom._setButtonListener(button, listener1);
        dom._setButtonListener(button, listener2);

        expect(addSpy).toHaveBeenCalledWith("click", button._clickHandler);
        expect(button._listener).toBe(listener2);
    });

    it("sets repeat button listener", () => {
        const listener = vi.fn();
        dom.setRepeatButtonListener(listener);
        expect(dom._setButtonListener).not.toHaveBeenCalled();
        document.body.innerHTML += `<button id="repeat"></button>`;
        dom = new GroupTestDomElements();
        spyAttributes(dom);
        dom.setRepeatButtonListener(listener);
        expect(dom._setButtonListener).toHaveBeenCalledWith(dom.repeatBtn, listener);
    });

    it("sets audio callback", async () => {
        const button = dom.nextBtn;
        const url = "/sound.mp3";
        const playSound = vi.fn();
        dom.setButtonAudioCallback(button, async function () {
            playSound(url);
            dom.setButtonAudioCallback(button, null);
        });
        const listener = vi.fn();
        dom._setButtonListener(button, listener);
        await button._clickHandler();
        expect(playSound).toHaveBeenCalledWith("/sound.mp3");
        expect(listener).toHaveBeenCalled();
        expect(button.audioCallback).toBe(null);
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

describe("GroupTestDomElements.showTestExit", () => {
    let dom;

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="test-exit" style="display: none"></div>
            <button id="log-out" style="visibility: visible"></button>
            <audio id="instructions-sound"></audio>
            <div id="student-header"></div>
            <div id="question-challenge"></div>
            <button id="end-summary"></button>
            <div class="scroll-wrapper">
                <div id="summary-container" class="summary-container"></div>
                <div id="summary-scroll-controls" class="scroll-controls">
                    <div id="scroll-summary-up" class="scroll-arrow disabled">
                        <i class="ph-fill ph-arrow-up"></i>
                    </div>
                    <div id="scroll-summary-down" class="scroll-arrow">
                        <i class="ph-fill ph-arrow-down"></i>
                    </div>
                </div>
            </div>

            <button id="next"></button>
            <div id="fade-overlay"></div>
            <div id="test-intro"></div>
            <div id="testpart-intro"></div>
            <div id="testpart-intro-text"></div>
            <div id="testpart-intro-image"></div>
            <div id="test-summary"></div>
            <div id="test-container"></div>
            <button id="repeat"></button>
        `;
        dom = new GroupTestDomElements();

        const originalLocation = window.location;
        delete window.location;
        window.location = { ...originalLocation, href: "" };

        vi.spyOn(dom, "_setButtonListener").mockImplementation((btn, listener) => {
            btn._clickHandler = listener;
            return btn;
        });
    });

    it("should show exit container and keep logout visible when online", async () => {
        const reachSpy = vi.spyOn(utils, "serverOnline").mockResolvedValue(true);

        await dom.showTestExit();

        expect(dom.testExit.style.display).toBe("flex");
        expect(dom.logOutButton.style.visibility).not.toBe("hidden");
        expect(reachSpy).toHaveBeenCalled();
    });

    it("should hide the logout button when the server is unreachable", async () => {
        vi.spyOn(utils, "serverOnline").mockResolvedValue(false);

        await dom.showTestExit();

        expect(dom.testExit.style.display).toBe("flex");
        expect(dom.logOutButton.style.visibility).toBe("hidden");
    });

    it("should redirect to /logout when clicked", async () => {
        vi.spyOn(utils, "serverOnline").mockResolvedValue(true);

        await dom.showTestExit();

        dom.logOutButton._clickHandler();

        expect(window.location.href).toBe("/logout");
    });
});
