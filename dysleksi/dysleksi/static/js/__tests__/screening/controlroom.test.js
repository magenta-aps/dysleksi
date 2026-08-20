/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi, assert } from "vitest";
import {
    EventTable,
    ActionButtons,
    TeacherView,
    NoteField,
    QuestionView,
    ElapsedTimeView,
    AudioIndicator,
} from "../../screening/controlroom.js";
import * as groupTestData from "./grouptest.json" with { type: "json" };
import * as individualTestData from "./individualtest.json" with { type: "json" };
import { Test } from "../../screening/model";
import { GroupTestContainer } from "../../screening/controlroom.js";
import { StudentCard } from "../../screening/controlroom.js";
import { Student } from "../../screening/model.js";
import { WebRTCChannel } from "../../webRTC.js";
import { DetailsPopup } from "../../screening/controlroom.js";
import { StudentPresenceIndicator } from "../../screening/controlroom.js";

vi.mock("../../screening/utils.js");

vi.mock("../../webRTC.js", () => {
    return {
        WebRTCChannel: vi.fn().mockImplementation(function () {
            const target = new EventTarget();

            this.addEventListener = target.addEventListener.bind(target);
            this.removeEventListener = target.removeEventListener.bind(target);
            this.dispatchEvent = target.dispatchEvent.bind(target);

            this.connect = vi.fn();
            this.send = vi.fn();
            this.close = vi.fn();
            this.peer = {
                on: vi.fn(),
                destroy: vi.fn(),
            };
        }),
    };
});

let resizeObserverCallback;

global.ResizeObserver = function (cb) {
    resizeObserverCallback = cb;
    this.observe = vi.fn();
    this.unobserve = vi.fn();
    this.disconnect = vi.fn();
};

const GROUP_DOM_HTML = `
<template id="student-card-template">
    <div class="student-card">
        <div class="student-top-row">
            <div class="progress-fill" style="width: 0%"></div>
            <div class="student-text">
                <span class="student-name"></span>
                <span class="student-current-part">-</span>
            </div>
        <div class="student-controls">
            <span class="status-icon">
                <i class="ph-fill ph-check-circle"></i>
            </span>
            <span class="student-control-button mark-button">
                <i class="ph-fill ph-flag-pennant"></i>
            </span>
            <span class="student-control-button">
                <i class="ph ph-dots-three"></i>
            </span>
            <span class="student-control-button">
                <i id="foldout-arrow" class="ph-fill ph-caret-down"></i>
            </span>
        </div>
            <div id="pause-overlay">
                <i class="ph-fill ph-pause"></i>
            </div>
        </div>
        <div class="folded-area" style="display: none;">
            <div class="parts-progress"></div>
            <div class="part-navigation">
                <div class="nav-group-left">
                    <i class="ph ph-caret-left nav-arrow"></i>
                    <span class="part-index"></span>
                </div>
                <i class="ph ph-caret-right nav-arrow"></i>
            </div>
            <span class="part-label"></span>
            <span class="question-index"></span>
            <div class="dots-container"></div>
        </div>
    </div>
</template>

<div class="screening-header">
    <h2>Klasse 1A - Screening Test</h2>
    <div class="screening-controls">
        <div class="screening-progress-wrapper">
            <span id="test-progress-label" class="screening-progress-label">0%</span>
            <div class="progress screening-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                <div id="test-progress-bar" class="progress-bar" style="width: 0%"></div>
            </div>
            <div id="elapsed-time"></div>
        </div>
        <button id="paused" class="btn btn-outline-secondary">
            <i class="ph-fill ph-pause"></i>
            <span class="pause-label">Pause</span>
        </button>
    </div>
</div>

<button id="all-students-button" class="btn btn-outline-primary">
  Alle (<span id="all-students-count">0</span>)
</button>

<button id="ongoing-students-button" class="btn btn-outline-primary">
  I gang (<span id="ongoing-students-count">0</span>)
</button>

<button id="finished-students-button" class="btn btn-outline-primary">
  <i class="ph-fill ph-check-circle green"></i>
  Færdige (<span id="finished-students-count">0</span>)
</button>

<button id="marked-students-button" class="btn btn-outline-primary">
  <i class="ph-fill ph-flag-pennant orange"></i>
  Mærket (<span id="marked-students-count">0</span>)
</button>

<div class="group-test-toolbar">
    <div class="toolbar-left">
        <button class="toolbar-btn" id="sort-button">
            Sortering: Navn (A-Å)
            <i id="sort-icon" class="ph ph-sort-ascending"></i>
        </button>
        <button class="toolbar-btn borderless" id="fold-all-button">
            <i class="ph ph-arrows-out-simple"></i>
            Fold alle ud/sammen
        </button>
        <div class="toolbar-view-switcher">
            <span class="view-label">Visning:</span>
            <button class="view-btn" data-columns="2">2</button>
            <button class="view-btn" data-columns="3">3</button>
            <button class="view-btn active" data-columns="4">4</button>
        </div>
    </div>
    <div class="toolbar-right">
        <span>Tegnforklaring:</span>
        <span class="dot-legend">
            <span class="dot correct"></span> Korrekt svar
        </span>
        <span class="dot-legend">
            <span class="dot wrong"></span> Forkert svar
        </span>
        <span class="dot-legend">
            <span class="dot partially-correct"></span> Delvist korrekt svar
        </span>
    </div>
</div>

<div class="group-test-body"></div>
    
<div class="group-test-footer">
    <div id="result-link-disabled" class="d-inline">
        <button class="btn btn-outline-secondary" disabled="disabled">Se resultater</button>
    </div>
    <a id="result-link-enabled" class="btn btn-outline-secondary d-none" href="/assignment/1/result/">Se resultater</a>
</div>
`;

const INDIVIDUAL_DOM_HTML = `
<div class="screening-header">
    <div class="screening-title">
        <h2>Anna Andersen - Screening Test</h2>
        <div id="student-presence" class="student-presence" data-state="waiting" role="status" aria-live="polite">
            <span class="student-presence-waiting">
                <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
                <span>Venter på elev</span>
            </span>
            <span class="student-presence-arrived">
                <i class="ph-fill ph-check-circle" aria-hidden="true"></i>
                <span class="visually-hidden">Eleven er kommet ind i testrummet</span>
            </span>
        </div>
    </div>
</div>
<div id="question-container">
    <h1 id="question-title"></h1>
    <div id="question-content"></div>
    <div id="part-name"></div>
    <div id="part-number"></div>
    <div id="question-number"></div>
</div>
<template id="edit-result">
    <div class="btn-group">
        <button type="button" class="btn dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
        </button>
        <ul class="dropdown-menu">
            <li><a class="dropdown-item" href="#correct">Korrekt</a></li>
            <li><a class="dropdown-item" href="#wrong">Forkert</a></li>
            <li><a class="dropdown-item" href="#skipped">Sprunget over</a></li>
        </ul>
    </div>
    <div class="actual-pronunciation"><input type="text"></div>
</template>
<table id="events"><tbody></tbody></table>
<button id="correct"><span>Korrekt</span></button>
<button id="wrong">Forkert</button>
<button id="cancelled">Afslut test</button>
<button id="paused"><i class="ph-fill ph-pause"></i></button>
<button id="skipped">Sprunget over</button>
<button id="next">Næste</button>
<button id="goto-next-result-group">Hop til næste</button>
<textarea id="note" class="d-none"></textarea>
<div id="audio-indicator"></div>
<div class="result-link">
    <div id="result-link-disabled" class="d-inline">
        <button class="btn btn-outline-secondary" disabled="disabled">Se resultater</button>
    </div>
    <a id="result-link-enabled" class="btn btn-outline-secondary d-none" href="/assignment/1/result/">Se resultater</a>
</div>
<div class="modal fade" id="error" tabindex="-1" aria-labelledby="error-label" aria-hidden="true">
    <div class="modal-dialog modal-lg">
        <div class="modal-content"><div class="modal-body"><div class="modal-body-inner"></div></div></div>
    </div>
</div>


<div class="details-wrapper">
    <button id="details-toggle" class="details-button" type="button" aria-expanded="false">
        <span>Se detaljer</span>
        <i class="ph-fill ph-caret-down"></i>
    </button>
    <div id="details-popup" class="details-popup" hidden>
        <div class="details-row">
            <span class="details-label">Testtype:</span>
            <span class="details-value">Individuel</span>
        </div>
    </div>
</div>
<div id="outside-element">Outside content</div>

`;

describe("ActionButtons", () => {
    const mockDoc = `
        <button id="correct"></button>
        <button id="wrong"></button>
        <button id="cancelled"></button>
        <button id="paused"></button>
        <button id="skipped"></button>
        <button id="next"></button>
    `;

    const getInstance = () => {
        return new ActionButtons();
    };

    const getButtons = (selector = "button") => {
        return document.querySelector(selector);
    };

    beforeEach(() => {
        document.body.innerHTML = mockDoc;
    });

    it("initializes", () => {
        const instance = getInstance();
        expect(instance.buttons).not.toBeNull();
        expect(instance.active).toBeNull();
    });

    it("can enable and disable all buttons", () => {
        const instance = getInstance();
        const buttons = getButtons();
        // Test initial state
        expect(buttons.classList).not.include(["disabled"]);
        // Test disabled state
        instance.disableButtons();
        expect(buttons.classList).include(["disabled"]);
        // Test enabled state
        instance.enableButtons();
        expect(buttons.classList).not.include(["disabled"]);
    });

    it("can show and hide all buttons", () => {
        const instance = getInstance();
        const buttons = getButtons();
        // Test initial state
        expect(buttons.classList).not.include(["d-none"]);
        // Test hidden state
        instance.hideButtons();
        expect(buttons.classList).include(["d-none"]);
        // Test shown state
        instance.showButtons();
        expect(buttons.classList).not.include(["d-none"]);
    });

    it("can enable and disable the 'next' button", () => {
        const instance = getInstance();
        // Test initial state
        expect(instance.nextButton().classList).not.to.include(["disabled"]);
        // Test disabled state
        instance.disableNextButton();
        expect(instance.nextButton().classList).to.include(["disabled"]);
        // Test enabled state
        instance.enableNextButton();
        expect(instance.nextButton().classList).not.to.include(["disabled"]);
    });

    it("can set the active button", () => {
        const instance = getInstance();
        const buttons = getButtons("#correct, #wrong, #skipped");
        // Test initial state (no buttons are active)
        expect(buttons.classList).not.to.include(["active"]);
        // Set "skipped" button as active
        instance.setActive("skipped");
        expect(instance.getActive()).toBe("skipped");
        expect(instance.skipButton().classList).to.include(["active"]);
        expect(instance.correctButton().classList).not.to.include(["active"]);
        expect(instance.wrongButton().classList).not.to.include(["active"]);
    });

    it("can clear the active button", () => {
        const instance = getInstance();
        const buttons = getButtons("#correct, #wrong, #skipped");
        instance.setActive("correct");
        instance.clearActive();
        expect(buttons.classList).not.to.include(["active"]);
    });
});

describe("ElapsedTimeView", () => {
    const mockDoc = `<div id="elapsed-time"></div>`;
    let instance;

    const getInstance = () => {
        return new ElapsedTimeView("#elapsed-time");
    };

    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = mockDoc;
        instance = getInstance();
    });

    afterEach(() => {
        vi.clearAllTimers();

        if (instance && instance.interval) {
            clearInterval(instance.interval);
        }

        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("initializes", () => {
        expect(instance.domElement).not.toBeNull();
        expect(instance.running).toBeFalsy();
        expect(instance.t1).toBeNull();
        expect(instance.interval).not.toBeNull();
    });

    it("can start", () => {
        // Start from first stopped state: initializes `instance.t1`
        instance.stop();
        instance.start();
        expect(instance.running).toBeTruthy();
        expect(instance.t1).not.toBeNull();
        expect(instance.t1 <= new Date()).toBeTruthy();
        const oldT1 = instance.t1;
        // Start from second stopped state: keeps previous `instance.t1`
        instance.stop();
        instance.start();
        expect(instance.running).toBeTruthy();
        expect(instance.t1 >= oldT1).toBeTruthy();
    });

    it("can stop", () => {
        instance.start();
        instance.stop();
        expect(instance.running).toBeFalsy();
        expect(instance.t1).not.toBeNull();
        expect(instance.t1 <= new Date()).toBeTruthy();
    });

    it("updates its DOM element", () => {
        // Test update when timer is stopped
        instance.stop();
        instance.update();
        expect(instance.domElement.innerText).toBeFalsy();
        // Test update when timer is started
        instance.start();
        instance.update();
        expect(instance.domElement.innerText).toMatch(/^-?\d{1,2}:\d{2}:\d{2}$/);
    });

    it("updates its DOM element on an interval", () => {
        const spyUpdate = vi.spyOn(instance, "update");
        // Let time pass
        vi.advanceTimersByTime(1000);
        // Assert: update was called by the interval
        expect(spyUpdate).toHaveBeenCalled();
    });

    it("can pause and resume", () => {
        instance.start();
        // Pausing a running timer freezes it and records when the pause began
        instance.pause();
        expect(instance.running).toBeFalsy();
        expect(instance.pauseStart).not.toBeNull();

        // Pausing again while already paused is a no-op
        const firstPauseStart = instance.pauseStart;
        instance.pause();
        expect(instance.pauseStart).toBe(firstPauseStart);

        // Resuming starts the timer again and banks the paused duration
        instance.resume();
        expect(instance.running).toBeTruthy();
        expect(instance.pauseStart).toBeNull();
        expect(instance.pausedDuration).toBeGreaterThanOrEqual(0);

        // Resuming again while already running does nothing
        const bankedDuration = instance.pausedDuration;
        instance.resume();
        expect(instance.pausedDuration).toBe(bankedDuration);
    });

    it("excludes paused time from the elapsed time", () => {
        instance.start();
        // Run for 5 seconds
        vi.advanceTimersByTime(5000);
        instance.pause();
        // Stay paused for 10 seconds
        vi.advanceTimersByTime(10000);
        instance.resume();
        // Run for 2 more seconds
        vi.advanceTimersByTime(2000);
        instance.update();
        // Only the 7 running seconds should be counted, not the 10 paused ones
        expect(instance.domElement.innerText).toMatch(/:00:07$/);
    });

    it("initialises the timer when resume is the first call", () => {
        expect(instance.t1).toBeNull();
        instance.resume();
        expect(instance.t1).not.toBeNull();
        expect(instance.running).toBeTruthy();
    });
});

describe("NoteField", () => {
    it("handles a present #note UI element", () => {
        document.body.innerHTML = `<textarea id="note" class="d-none">Min note</textarea>`;
        const noteField = new NoteField();
        expect(noteField.noteEl).not.toBeNull();
        expect(noteField.getNote()).toBe("Min note");
        noteField.clearNote();
        expect(noteField.getNote()).toBe("");
        noteField.show();
        expect(noteField.noteEl.classList).not.toContain("d-none");
    });

    it("handles a missing #note UI element", () => {
        document.body.innerHTML = ``;
        const noteField = new NoteField();
        expect(noteField.noteEl).toBeNull();
        expect(noteField.getNote()).toBeUndefined();
        expect(noteField.clearNote()).toBeUndefined();
        expect(noteField.show()).toBeUndefined();
    });
});

describe("AudioIndicator", () => {
    const mockDoc = `<div id="audio-indicator"></div>`;

    const getInstance = () => {
        return new AudioIndicator();
    };

    beforeEach(() => {
        document.body.innerHTML = mockDoc;
    });

    it("initializes", () => {
        const audioIndicator = getInstance();
        expect(audioIndicator.el).not.toBeNull();
        expect(audioIndicator.bars).not.toBeNull();
        expect(audioIndicator.bars.length).toBe(audioIndicator.numBars);
        expect(audioIndicator.el.childNodes.length).toBe(audioIndicator.numBars);
        expect(audioIndicator.req).toBeNull();
    });

    it("renders a single frame", () => {
        const audioIndicator = getInstance();
        const spyGetHeight = vi.spyOn(audioIndicator, "getHeight");
        audioIndicator.render();
        expect(spyGetHeight).toHaveBeenCalled();
    });

    it("can start", () => {
        const audioIndicator = getInstance();
        const spyRender = vi.spyOn(audioIndicator, "render");
        audioIndicator.start();
        expect(audioIndicator.req).not.toBeNull();
        expect(spyRender).toHaveBeenCalled();
    });

    it("can stop", () => {
        const audioIndicator = getInstance();
        audioIndicator.start();
        expect(audioIndicator.req).not.toBeNull();
        audioIndicator.stop();
        expect(audioIndicator.req).toBeNull();
    });
});

describe("Teacher Individual test View", () => {
    let socket;
    let table;
    let buttons;
    let note;
    let questionView;
    let elapsedTimeView;
    let audioIndicator;
    let view;
    let wsGetter;
    let individualTest;
    let mainSocketHandler;
    let p2pChannel;
    const studentId = 123;

    beforeEach(() => {
        vi.useFakeTimers();
        global.localStorage = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            clear: vi.fn(),
        };

        socket = {
            addEventListener: vi.fn(),
            send: vi.fn(),
        };

        wsGetter = vi.fn().mockReturnValue(socket);

        document.body.innerHTML = INDIVIDUAL_DOM_HTML;

        // Mock out asset preloader
        vi.spyOn(Test.prototype, "preload").mockResolvedValue(new Map());

        // Load test data
        new Test(groupTestData);
        individualTest = new Test(individualTestData);

        // Init UI components
        table = new EventTable(individualTest);
        buttons = new ActionButtons();
        note = new NoteField();
        questionView = new QuestionView();
        elapsedTimeView = new ElapsedTimeView("#elapsed-time");
        audioIndicator = new AudioIndicator("#audio-indicator");

        view = new TeacherView(
            individualTest,
            1,
            wsGetter,
            table,
            buttons,
            note,
            questionView,
            elapsedTimeView,
            audioIndicator,
        );

        mainSocketHandler = socket.addEventListener.mock.calls.find(
            (c) => c[0] === "message",
        )[1];
        mainSocketHandler({
            data: JSON.stringify({
                event: "student.joined",
                studentId,
                assignmentId: 1,
            }),
        });
        [p2pChannel] = view.studentChannels[studentId];
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("sends 'skipped' for 'correctness' when the skip button is clicked", () => {
        vi.spyOn(global.crypto, "randomUUID").mockReturnValue("UUID-SKIP");

        view.setPartIndex(0);
        view.setQuestionIndex(0);

        // Click the skip button
        const skipButton = buttons.skipButton();
        skipButton.click();

        expect(p2pChannel.send).toHaveBeenCalledWith({
            uuid: "UUID-SKIP",
            event: "question.feedback",
            partIndex: 0,
            questionIndex: 0,
            questionId: 1,
            partId: 1,
            assignmentId: 1,
            correctness: "skipped",
            note: "",
            practice: undefined,
            student: { id: "123" },
        });
    });

    it("updates indices but does not enable buttons when event is 'question.answered'", () => {
        // 1. Setup: Ensure buttons are currently disabled
        buttons.disableButtons();

        // 2. Trigger 'question.answered'
        // This hits the outer IF but fails the 'question.displayed' IF
        p2pChannel.dispatchEvent(
            new CustomEvent("message", {
                detail: {
                    event: "question.answered",
                    partIndex: 0,
                    questionIndex: 0,
                    practice: false,
                    answeredAt: "10:00:05",
                },
            }),
        );

        // 3. Assertions
        // Indices should be updated
        expect(view.partIndex).toBe(0);
        expect(view.questionIndex).toBe(0);

        // Buttons should REMAIN disabled (because the 'question.displayed' block was skipped)
        const btn = document.querySelector("#correct");
        expect(btn.classList.contains("disabled")).toBe(true);
    });

    it("initializes default sub-views when optional arguments are omitted", () => {
        // We only pass the required arguments: test, assignmentId, wsGetter
        // The rest (table, buttons, noteField, questionView) will fall back to 'new' instances
        const minimalView = new TeacherView(individualTest, 1, wsGetter);

        // Verify that the properties are instances of their respective classes
        expect(minimalView.table).toBeInstanceOf(EventTable);
        expect(minimalView.buttons).toBeInstanceOf(ActionButtons);
        expect(minimalView.noteField).toBeInstanceOf(NoteField);
        expect(minimalView.questionView).toBeInstanceOf(QuestionView);

        // Verify that they attached to the DOM correctly
        // (Since beforeEach sets up the HTML, these should find their elements)
        expect(minimalView.table.eventsEl).not.toBeNull();
        expect(minimalView.noteField.noteEl).not.toBeNull();
    });

    it("throws an error when an out-of-bounds practice question index is received", () => {
        // We set practice: true, but provide an index (e.g., 99) that
        // exceeds the practice array length for part 0
        const invalidPracticeIndex = 99;
        view.setPartIndex(0);

        expect(() => {
            view.setQuestionIndex(invalidPracticeIndex, true);
        }).toThrow(`Invalid question index ${invalidPracticeIndex}`);
    });

    it("sets the currentQuestion from the practice array when practice is true", () => {
        // 1. Set the part index so we have a context for questions
        view.setPartIndex(0);

        // 2. Call setQuestionIndex with practice = true
        // We assume individualTest.parts[0].practice[0] exists in your JSON
        const practiceIndex = 0;
        view.setQuestionIndex(practiceIndex, true);

        // 3. Assertions
        const expectedPracticeQuestion =
            individualTest.parts[0].practice[practiceIndex];

        expect(view.questionIndex).toBe(practiceIndex);
        expect(view.currentQuestion).toBe(expectedPracticeQuestion);

        // Verify it didn't accidentally take the standard question at that index
        const standardQuestion = individualTest.parts[0].questions[practiceIndex];
        expect(view.currentQuestion).not.toBe(standardQuestion);
    });

    it("updates part name, part number and question number when question changes", () => {
        // Arrange
        const partName = document.getElementById("part-name");
        const partNumber = document.getElementById("part-number");
        const questionNumber = document.getElementById("question-number");
        const thisQuestionView = new QuestionView(
            "#question-container",
            "#question-title",
            "#question-content",
            "#part-name",
            "#part-number",
            "#question-number",
        );
        view = new TeacherView(
            individualTest,
            1,
            wsGetter,
            table,
            buttons,
            note,
            thisQuestionView,
        );

        // Act: go to another part
        view.setPartIndex(0);
        // Assert
        expect(partName.innerText).toBe(view.test.parts[0].name);
        expect(partNumber.innerText).toBe("Deltest 1 af 3");

        // Act: go to instruction question
        view.setQuestionIndex(0, true);
        // Assert
        expect(partName.innerText).toBe(view.test.parts[0].name);
        expect(partNumber.innerText).toBe("Deltest 1 af 3");
        expect(questionNumber.innerText).toBe("Instruktion 1 af 2");

        // Act: go to practice question
        view.setQuestionIndex(1, true);
        // Assert
        expect(partName.innerText).toBe(view.test.parts[0].name);
        expect(partNumber.innerText).toBe("Deltest 1 af 3");
        expect(questionNumber.innerText).toBe("Øveopgave 1 af 1");

        // Act: go to real question
        view.setQuestionIndex(0, false);
        // Assert
        expect(partName.innerText).toBe(view.test.parts[0].name);
        expect(partNumber.innerText).toBe("Deltest 1 af 3");
        expect(questionNumber.innerText).toBe("Opgave 1 af 3");
    });

    it("initializes socket and button listeners", () => {
        expect(wsGetter).toHaveBeenCalledWith();
        expect(socket.addEventListener).toHaveBeenCalledWith(
            "message",
            expect.any(Function),
        );
    });

    it("enables buttons on question.displayed", () => {
        // trigger a question.displayed event
        p2pChannel.dispatchEvent(
            new CustomEvent("message", {
                detail: {
                    event: "question.displayed",
                    partIndex: 0,
                    questionIndex: 0,
                    questionTitle: "Q1",
                    displayedAt: 1000,
                },
            }),
        );

        const btn = document.querySelector("button");
        expect(btn.classList.contains("disabled")).toBe(false);
    });

    it("disables 'next' button on 'question.displayed' (individual tests)", () => {
        // trigger first question.displayed event - question type is "free_text"
        p2pChannel.dispatchEvent(
            new CustomEvent("message", {
                detail: {
                    event: "question.displayed",
                    partIndex: 0,
                    questionIndex: 0,
                },
            }),
        );
        const btn = document.querySelector("button");
        expect(btn.classList.contains("disabled")).toBe(false);

        // Trigger another `question.displayed` event - this time the question type is
        // "no_input_required" and it is a practice question, and the instructions are
        // currently displaying.
        view.showingInstructions = true;
        p2pChannel.dispatchEvent(
            new CustomEvent("message", {
                detail: {
                    event: "question.displayed",
                    practice: true,
                    partIndex: 0,
                    questionIndex: 2,
                },
            }),
        );
        expect(buttons.nextButton().classList).to.include(["disabled"]);

        // Trigger another `question.displayed` event - this time the question type is
        // "no_input_required" and it is a practice question, and the instructions are
        // completed.
        view.showingInstructions = false;
        p2pChannel.dispatchEvent(
            new CustomEvent("message", {
                detail: {
                    event: "question.displayed",
                    practice: true,
                    partIndex: 0,
                    questionIndex: 2,
                },
            }),
        );
        expect(buttons.nextButton().classList).not.to.include(["disabled"]);

        // Trigger another `question.displayed` event - this time the question type is
        // "no_input_required" and it is an actual question.
        p2pChannel.dispatchEvent(
            new CustomEvent("message", {
                detail: {
                    event: "question.displayed",
                    practice: false,
                    partIndex: 0,
                    questionIndex: 1,
                },
            }),
        );
        expect(buttons.nextButton().classList).to.include(["disabled"]);
    });

    it("show question on question.displayed", () => {
        questionView.show();
        expect(questionView.containerElement.classList.contains("d-none")).toBe(false);

        // trigger a question.displayed event
        p2pChannel.dispatchEvent(
            new CustomEvent("message", {
                detail: {
                    event: "question.displayed",
                    partIndex: 0,
                    questionIndex: 0,
                },
            }),
        );

        expect(questionView.titleElement.textContent).toBe("1/3 (Individuel deltest)");

        p2pChannel.dispatchEvent(
            new CustomEvent("message", {
                detail: {
                    event: "question.displayed",
                    partIndex: 0,
                    questionIndex: 1,
                },
            }),
        );

        expect(questionView.titleElement.textContent).toBe("2/3 (Individuel deltest)");
    });

    it("sends message and disables buttons on click", () => {
        vi.spyOn(global.crypto, "randomUUID").mockReturnValue("UUID123");

        // Add data in note field
        note.noteEl.value = "Test note";
        view.setPartIndex(0);
        view.setQuestionIndex(0);

        // click the button
        const wrongButton = buttons.wrongButton();
        wrongButton.click();

        expect(p2pChannel.send).toHaveBeenCalledWith({
            uuid: "UUID123",
            event: "question.feedback",
            partIndex: 0,
            questionIndex: 0,
            questionId: 1,
            partId: 1,
            assignmentId: 1,
            correctness: "wrong",
            note: "Test note",
            practice: undefined,
            student: { id: "123" },
        });

        expect(wrongButton.classList.contains("disabled")).toBe(true);
    });

    it("delays sending feedback if question type is 'no_input_required'", () => {
        vi.spyOn(global.crypto, "randomUUID").mockReturnValue("UUID123");

        // Arrange: go directly to question 2 (which is type "no_input_required")
        view.setPartIndex(0);
        view.setQuestionIndex(1);

        // Act: fill out fields and click "wrong"
        note.noteEl.value = "Test note";
        buttons.wrongButton().click();

        // Assert: no socket message sent yet
        expect(p2pChannel.send).not.toHaveBeenCalled();

        // Act: click "next"
        buttons.nextButton().click();

        expect(p2pChannel.send).toHaveBeenCalledWith({
            uuid: "UUID123",
            event: "question.feedback",
            partIndex: 0,
            questionIndex: 1,
            questionId: 2,
            partId: 1,
            assignmentId: 1,
            correctness: "wrong",
            note: "Test note",
            practice: undefined,
            student: { id: "123" },
        });
    });

    it("warns if trying to send feedback for more than one student in individual tests", () => {
        // Arrange: pretend we are connected to two students
        const mockChannel = { send: vi.fn() };
        view.studentChannels = { 1: [mockChannel], 2: [mockChannel] };
        // Arrange: go to question and mark it correct
        view.setPartIndex(0);
        view.setQuestionIndex(1);
        buttons.correctButton().click();
        // Act: click "next"
        buttons.nextButton().click();
        // Assert: no socket message sent
        expect(p2pChannel.send).not.toHaveBeenCalled();
    });

    it("unpauses the total elapsed time on `question.displayed`", () => {
        // Arrange
        const spyStart = vi.spyOn(elapsedTimeView, "start");
        // Act: send "question.displayed"
        p2pChannel.dispatchEvent(
            new CustomEvent("message", {
                detail: {
                    event: "question.displayed",
                    partIndex: 0,
                    questionIndex: 0,
                    practice: false,
                },
            }),
        );
        // Assert
        expect(spyStart).toHaveBeenCalled();
    });

    it("pauses the total elapsed time on `question.answered`", () => {
        // Arrange
        const spyStop = vi.spyOn(elapsedTimeView, "stop");
        // Act: send "question.answered"
        p2pChannel.dispatchEvent(
            new CustomEvent("message", {
                detail: {
                    event: "question.answered",
                    partIndex: 0,
                    questionIndex: 0,
                    practice: false,
                },
            }),
        );
        // Assert
        expect(spyStop).toHaveBeenCalled();
    });

    it("does not start or stop the elapsed time during practice questions", () => {
        // Arrange
        const spyStart = vi.spyOn(elapsedTimeView, "start");
        const spyStop = vi.spyOn(elapsedTimeView, "stop");
        // Act: send "question.displayed"
        p2pChannel.dispatchEvent(
            new CustomEvent("message", {
                detail: {
                    event: "question.displayed",
                    partIndex: 0,
                    questionIndex: 0,
                    practice: true,
                },
            }),
        );
        // Assert
        expect(spyStart).not.toHaveBeenCalled();
        // Act: send "question.answered"
        p2pChannel.dispatchEvent(
            new CustomEvent("message", {
                detail: {
                    event: "question.answered",
                    partIndex: 0,
                    questionIndex: 0,
                    practice: true,
                },
            }),
        );
        // Assert
        expect(spyStop).not.toHaveBeenCalled();
    });

    it("does not update the elapsed time on practice questions", () => {
        // Arrange
        const spyStart = vi.spyOn(elapsedTimeView, "stop");
        const spyStop = vi.spyOn(elapsedTimeView, "stop");
        // Act: send "question.displayed"
        p2pChannel.dispatchEvent(
            new CustomEvent("message", {
                detail: {
                    event: "question.displayed",
                    partIndex: 0,
                    questionIndex: 0,
                    practice: true,
                },
            }),
        );
        expect(spyStart).not.toHaveBeenCalled();
        expect(spyStop).not.toHaveBeenCalled();
        // Act: send practice "question.answered"
        p2pChannel.dispatchEvent(
            new CustomEvent("message", {
                detail: {
                    event: "question.answered",
                    partIndex: 0,
                    questionIndex: 0,
                    practice: true,
                },
            }),
        );
        // Assert
        expect(spyStart).not.toHaveBeenCalled();
        expect(spyStop).not.toHaveBeenCalled();
    });

    it("does not update elapsed time if the UI component is null", () => {
        // Arrange: configure view without elapsed time component
        view.elapsedTimeView = null;
        const spyStart = vi.spyOn(elapsedTimeView, "stop");
        // Act: send relevant message
        p2pChannel.dispatchEvent(
            new CustomEvent("message", {
                detail: {
                    event: "question.displayed",
                    partIndex: 0,
                    questionIndex: 0,
                    practice: false,
                },
            }),
        );
        // Assert
        expect(spyStart).not.toHaveBeenCalled();
    });

    it("sends message and disables buttons on cancel click", () => {
        vi.spyOn(global.crypto, "randomUUID").mockReturnValue("UUID123");

        // Add data in note field
        note.noteEl.value = "Test note";
        view.setPartIndex(0);
        view.setQuestionIndex(0);

        // click the button
        const cancelButton = buttons.cancelButton();
        cancelButton.click();

        const expectedContent = {
            uuid: "UUID123",
            event: "test.cancelled",
            partIndex: 0,
            questionIndex: 0,
            questionId: 1,
            partId: 1,
            assignmentId: 1,
            note: "Test note",
        };

        global.confirm = vi.fn().mockReturnValue(true);
        buttons.cancelButton().click();
        expect(p2pChannel.send).toHaveBeenCalledWith(expectedContent);
        expect(buttons.cancelButton().classList.contains("disabled")).toBe(true);
    });

    it("pauses and resumes the test when the pause button is clicked", () => {
        vi.spyOn(global.crypto, "randomUUID").mockReturnValue("UUID-PAUSE");
        const spyPause = vi.spyOn(elapsedTimeView, "pause");
        const spyResume = vi.spyOn(elapsedTimeView, "resume");
        const pauseButton = buttons.pauseButton();

        // Initial state: the test is running
        expect(view.testPaused).toBe(false);

        // Act: click the pause button to pause the test
        pauseButton.click();

        // Assert: the test is paused, the timer stops and the icon becomes 'play'
        expect(view.testPaused).toBe(true);
        expect(spyPause).toHaveBeenCalled();
        expect(pauseButton.classList.contains("is-paused")).toBe(true);
        expect(pauseButton.querySelector("i").className).toBe("ph-fill ph-play");
        expect(p2pChannel.send).toHaveBeenCalledWith({
            uuid: "UUID-PAUSE",
            event: "test.paused",
            assignmentId: 1,
        });

        // Act: click the pause button again to resume the test
        pauseButton.click();

        // Assert: the test is running again, the timer resumes and the icon becomes 'pause'
        expect(view.testPaused).toBe(false);
        expect(spyResume).toHaveBeenCalled();
        expect(pauseButton.classList.contains("is-paused")).toBe(false);
        expect(pauseButton.querySelector("i").className).toBe("ph-fill ph-pause");
        expect(p2pChannel.send).toHaveBeenCalledWith({
            uuid: "UUID-PAUSE",
            event: "test.resume",
            assignmentId: 1,
        });
    });

    it("updates the event table when handling question feedback", () => {
        // Arrange
        view.setPartIndex(0);
        view.setQuestionIndex(0);
        const numRowsBefore = view.table.eventsEl.querySelectorAll("tbody tr").length;
        // Act: send question feedback
        view.sendQuestionFeedback("correct");
        // Assert: new row is added to event table
        const numRowsAfter = view.table.eventsEl.querySelectorAll("tbody tr").length;
        expect(numRowsBefore).not.toBeUndefined();
        expect(numRowsAfter).not.toBeUndefined();
        expect(numRowsAfter).toEqual(numRowsBefore + 1);
    });

    it("does not update a non-existent event table when handling question feedback", () => {
        // Arrange
        view.setPartIndex(0);
        view.setQuestionIndex(0);
        // Arrange: remove event table component from view
        view.table = null;
        // Act: send question feedback
        view.sendQuestionFeedback("correct");
        // Assert: no rows were added to table DOM element
        const rows = document.querySelector("table#events tbody");
        expect(rows.childNodes.length).toBe(0);
    });

    it("raise error when incorrect partindex is received", () => {
        const invalidIndexes = [
            null,
            undefined,
            -1,
            individualTest.parts.length,
            individualTest.parts.length + 1,
        ];
        for (const index of invalidIndexes) {
            try {
                view.validatePartIndex(index);
                assert.fail("Exception not raised for part index " + index);
            } catch {}
        }
    });

    it("raise error when incorrect questionindex is received", () => {
        view.setPartIndex(0);

        const invalidIndexes = [
            null,
            undefined,
            -1,
            individualTest.parts[0].questions.length,
            individualTest.parts[0].questions.length + 1,
        ];
        for (const index of invalidIndexes) {
            try {
                view.validateQuestionIndex(index);
                assert.fail("Exception not raised for question index " + index);
            } catch {}
        }
    });

    it("buttonview hide buttons", () => {
        buttons.hideButtons();
        expect(buttons.correctButton().classList.contains("d-none")).toBe(true);
        expect(buttons.wrongButton().classList.contains("d-none")).toBe(true);
        expect(buttons.cancelButton().classList.contains("d-none")).toBe(true);
        expect(buttons.skipButton().classList.contains("d-none")).toBe(true);
    });

    it("buttonview show buttons", () => {
        buttons.showButtons();
        expect(buttons.correctButton().classList.contains("d-none")).toBe(false);
        expect(buttons.wrongButton().classList.contains("d-none")).toBe(false);
        expect(buttons.cancelButton().classList.contains("d-none")).toBe(false);
        expect(buttons.skipButton().classList.contains("d-none")).toBe(false);
    });

    it("noteview get note", () => {
        note.noteEl.value = "Test note";
        expect(note.getNote()).toBe("Test note");
    });

    it("noteview clear note", () => {
        note.noteEl.value = "Test note";
        note.clearNote();
        expect(note.getNote()).toBe("");
    });

    it("noteview show", () => {
        note.noteEl.value = "Test note";
        note.show();
        expect(note.noteEl.classList.contains("d-none")).toBe(false);
        expect(note.noteEl.outerHTML).toBe('<textarea id="note" class=""></textarea>');
    });

    it("questionview cleans up", () => {
        const container = document.querySelector("#question-content");

        questionView.showContent("Test content", "/test/image.png");
        expect(container.querySelector("#challenge-image").src).toContain(
            "/test/image.png",
        );
        expect(container.querySelector("#challenge-text").textContent).toBe(
            "Test content",
        );

        questionView.showContent("Test content", "/test/image2.png");
        expect(container.querySelector("#challenge-image").src).toContain(
            "/test/image2.png",
        );
        expect(container.querySelector("#challenge-text").textContent).toBe(
            "Test content",
        );

        questionView.showContent("Test content");
        expect(container.querySelector("#challenge-image")).toBeNull();
        expect(container.querySelector("#challenge-text").textContent).toBe(
            "Test content",
        );

        questionView.showContent(null, "/test/image.png");
        expect(container.querySelector("#challenge-image").src).toContain(
            "/test/image.png",
        );
        expect(container.querySelector("#challenge-text")).toBeNull();
    });

    it("handles action button events inside 'span' elements", () => {
        // Arrange
        const spySendQuestionFeedback = vi.spyOn(view, "sendQuestionFeedback");
        view.setPartIndex(0);
        view.setQuestionIndex(0);
        // Act: click on 'span' element inside button, rather than button itself
        const span = document.querySelector("button#correct span");
        span.dispatchEvent(new Event("click", { bubbles: true }));
        // Assert
        expect(spySendQuestionFeedback).toHaveBeenCalled();
    });

    it("renders paused audio indicator when the test starts", () => {
        // Arrange
        const spyRender = vi.spyOn(audioIndicator, "render");
        // Act: start test
        p2pChannel.dispatchEvent(
            new CustomEvent("message", {
                detail: {
                    event: "test.started",
                    partIndex: 0,
                    questionIndex: 0,
                },
            }),
        );
        // Assert: audio indicator renders paused
        expect(spyRender).toHaveBeenCalledWith(0);
    });

    it("confirms that the student has entered the room when the test starts", () => {
        // Arrange: the teacher is waiting for the student
        const presenceEl = document.querySelector("#student-presence");
        expect(presenceEl.dataset.state).toBe("waiting");
        // Act: start test
        p2pChannel.dispatchEvent(
            new CustomEvent("message", {
                detail: {
                    event: "test.started",
                    partIndex: 0,
                    questionIndex: 0,
                },
            }),
        );
        // Assert: the confirmation is shown, and hidden again after 5 seconds
        expect(presenceEl.dataset.state).toBe("arrived");
        vi.advanceTimersByTime(4999);
        expect(presenceEl.dataset.state).toBe("arrived");
        vi.advanceTimersByTime(1);
        expect(presenceEl.dataset.state).toBe("done");
    });

    it("runs animated audio indicator while the student answers", () => {
        // Arrange
        const spyStart = vi.spyOn(audioIndicator, "start");
        // Act: send "audio.detected" event
        p2pChannel.dispatchEvent(
            new CustomEvent("message", { detail: { event: "audio.detected" } }),
        );
        // Assert: audio indicator animation is started
        expect(spyStart).toHaveBeenCalled();
    });

    it("stops animated audio indicator when the student has answered", () => {
        // Arrange
        const spyStop = vi.spyOn(audioIndicator, "stop");
        // Act: send "audio.quiet" event
        p2pChannel.dispatchEvent(
            new CustomEvent("message", { detail: { event: "audio.quiet" } }),
        );
        // Assert: audio indicator animation is started
        expect(spyStop).toHaveBeenCalled();
    });

    it("finds the 'goto next result group' button in DOM", () => {
        expect(view.gotoNextResultGroupButton).not.toBeNull();
        // Initial button state is disabled
        expect(view.gotoNextResultGroupButton.classList).include(["disabled"]);
    });

    it("updates the enabled/disabled state of the 'go to next result group' button", () => {
        const gotoQuestion = (practice, questionIndex, partIndex) => {
            p2pChannel.dispatchEvent(
                new CustomEvent("message", {
                    detail: {
                        event: "question.displayed",
                        partIndex: partIndex,
                        questionIndex: questionIndex,
                        practice: practice,
                    },
                }),
            );
        };

        // Act: go to practice question
        gotoQuestion(true, 0, 0);
        // Assert: button is disabled
        expect(view.gotoNextResultGroupButton.classList).include(["disabled"]);

        // Act: go to non-practice question
        gotoQuestion(false, 0, 0);
        // Assert: button is enabled
        expect(view.gotoNextResultGroupButton.classList).not.include(["disabled"]);

        // Act: go to first non-practice question in part with result groups
        gotoQuestion(false, 0, 1);
        // Assert: button is enabled
        expect(view.gotoNextResultGroupButton.classList).not.include(["disabled"]);

        // Act: go to last result group in last part
        gotoQuestion(false, 1, 2);
        // Assert: button is disabled
        expect(view.gotoNextResultGroupButton.classList).include(["disabled"]);
    });

    it("handles click events on the 'goto next result group button'", () => {
        // Arrange
        const spyGoto = vi.spyOn(view, "gotoNextResultGroup");
        // Act: dispatch click event on button
        view.gotoNextResultGroupButton.dispatchEvent(new Event("click"));
        // Assert: handler was called
        expect(spyGoto).toHaveBeenCalled();
    });

    it("can go to next result group", () => {
        // Arrange: go to second test part (which has result groups)
        view.setPartIndex(1);
        view.setQuestionIndex(0);
        // Act: go to next result group in *this* test part
        view.gotoNextResultGroup();
        // Assert: we are at the first question in result group 'B'
        expect(view.currentPart.index).toBe(1); // unchanged
        expect(view.currentQuestion.index).toBe(2);
        expect(view.currentQuestion.resultGroup).toBe("B");
        // Act: try to go to next result group again. Since we are at the last
        // result group, this means that we end the current test part and send
        // the student to the next test part (if any.)
        view.gotoNextResultGroup();
        expect(view.currentPart.index).toBe(2); // changed
        expect(view.currentQuestion.index).toBe(0);
        expect(view.currentQuestion.resultGroup).toBeUndefined();
        // Act: go to next result group in the new test part. As there are no
        // result groups defined in this test part, this does nothing.
        view.gotoNextResultGroup();
        expect(view.currentPart.index).toBe(2); // unchanged
        expect(view.currentQuestion.index).toBe(0); // unchanged
    });

    it("displays an error modal if student audio setup fails", () => {
        // Act: send "setup.error" event (this is not sent on the P2P channel)
        mainSocketHandler({
            data: JSON.stringify({ event: "setup.error" }),
        });
        // Assert: modal is displayed
        const modal = document.querySelector("#error");
        const modalBody = modal.querySelector(".modal-body-inner");
        expect(modal).not.toBeNull();
        expect(modal.classList.display).not.toBe("none");
        expect(modalBody.innerHTML).not.toBe("");
    });

    it("displays an error modal if student audio input is silent", () => {
        // Act: send "audio.silent" event
        p2pChannel.dispatchEvent(
            new CustomEvent("message", {
                detail: {
                    event: "audio.silent",
                    student: {
                        displayName: "Elev E.",
                    },
                },
            }),
        );
        // Assert: modal is displayed
        const modal = document.querySelector("#error");
        const modalBody = modal.querySelector(".modal-body-inner");
        expect(modal).not.toBeNull();
        expect(modal.classList.display).not.toBe("none");
        expect(modalBody.innerHTML).not.toBe("");
    });

    it("listens for 'questionFeedbackEdited' events from `EventTable`", () => {
        // Arrange
        const spySendQuestionFeedbackToServer = vi.spyOn(
            view,
            "sendQuestionFeedbackToServer",
        );
        // Act
        view.table.dispatchEvent(
            new CustomEvent("questionFeedbackEdited", { detail: null }),
        );
        // Assert
        expect(spySendQuestionFeedbackToServer).toHaveBeenCalled();
    });

    it("listens for `instructions.started` student events", () => {
        // Arrange
        const spyDisableNextButton = vi.spyOn(view.buttons, "disableNextButton");
        // Act
        p2pChannel.dispatchEvent(
            new CustomEvent("message", { detail: { event: "instructions.started" } }),
        );
        // Assert
        expect(view.showingInstructions).toBeTruthy();
        expect(spyDisableNextButton).toHaveBeenCalled();
    });

    it("listens for `instructions.completed` student events", () => {
        // Arrange
        const spyEnableNextButton = vi.spyOn(view.buttons, "enableNextButton");
        // Act
        p2pChannel.dispatchEvent(
            new CustomEvent("message", { detail: { event: "instructions.completed" } }),
        );
        // Assert
        expect(view.showingInstructions).toBeFalsy();
        expect(spyEnableNextButton).toHaveBeenCalled();
    });

    it("shows the result link on `test.complete` student events", () => {
        // Arrange
        const disabled = document.getElementById("result-link-disabled");
        const enabled = document.getElementById("result-link-enabled");
        expect(disabled.classList.contains("d-none")).toBe(false);
        expect(enabled.classList.contains("d-none")).toBe(true);
        // Act
        p2pChannel.dispatchEvent(
            new CustomEvent("message", { detail: { event: "test.complete" } }),
        );
        // Assert
        expect(disabled.classList.contains("d-none")).toBe(true);
        expect(enabled.classList.contains("d-none")).toBe(false);
    });
});

describe("GroupTestContainer", () => {
    let instance;

    beforeEach(() => {
        document.body.innerHTML = GROUP_DOM_HTML;

        const test = {
            parts: [
                {
                    name: "part1",
                    questions: [{}],
                },
                {
                    name: "part2",
                    questions: [{}],
                },
            ],
        };

        instance = new GroupTestContainer(test);
    });

    it("Updates current view part when a student changes part", () => {
        let studentData = {
            student: {
                id: 5,
                firstName: "Eve",
                lastName: "Online",
                progress: 20,
                currentPartIndex: 0,
                currentQuestionIndex: 0,
                resultsByPart: {},
            },
        };

        // Simulate a student starting the test
        instance.updateData(studentData);
        let card = instance.cards.get(5);

        // The teacher is shown the results for part 1
        expect(card.currentViewPartIndex).toBe(0);

        // Simulate a student completing the first question
        studentData.student.currentQuestionIndex = 1;
        instance.updateData(studentData);
        card = instance.cards.get(5);

        // The teacher is stil being shown the results for part 1
        expect(card.currentViewPartIndex).toBe(0);

        // Simulate a student finishing the first part
        studentData.student.currentQuestionIndex = 0;
        studentData.student.currentPartIndex = 1;
        instance.updateData(studentData);
        card = instance.cards.get(5);

        // The student has now completed the first part and is viewing the next part
        // The teacher's card follows the student progress and shows part 1
        expect(card.currentViewPartIndex).toBe(1);
    });

    it("updates the progress bar to the average progress across all students", () => {
        const makeStudent = (id, progress) => ({
            student: {
                id,
                firstName: `Student${id}`,
                lastName: "Test",
                progress,
                currentPartIndex: 0,
                currentQuestionIndex: 0,
                resultsByPart: {},
            },
        });

        const progressBar = document.getElementById("test-progress-bar");
        const progressLabel = document.getElementById("test-progress-label");

        instance.updateData(makeStudent(1, 60));
        expect(progressBar.style.width).toBe("60%");
        expect(progressLabel.textContent).toBe("60%");

        // The bar shows the average of the two students: (60 + 20) / 2 = 40
        instance.updateData(makeStudent(2, 20));
        expect(progressBar.style.width).toBe("40%");
        expect(progressLabel.textContent).toBe("40%");

        // Non-integer averages are rounded: (60 + 20 + 35) / 3 = 38.33 -> 38
        instance.updateData(makeStudent(3, 35));
        expect(progressBar.style.width).toBe("38%");
        expect(progressLabel.textContent).toBe("38%");
    });

    it("toggles folded area even when clicking on child elements (name text)", () => {
        const studentData = {
            student: {
                id: 5,
                firstName: "Eve",
                lastName: "Online",
                progress: 20,
                currentPartIndex: 0,
                currentQuestionIndex: 0,
                resultsByPart: {},
            },
        };
        instance.updateData(studentData);

        const card = instance.cards.get(5);
        const folded = card.el.querySelector(".folded-area");
        const nameSpan = card.el.querySelector(".student-name");

        // Ensure it's hidden initially
        folded.style.display = "none";

        // Click on the span (target is NOT .folded-area, so it should NOT return early)
        nameSpan.click();

        expect(folded.style.display).toBe("flex");
    });

    it("does NOT toggle folded area when clicking directly on the folded area content", () => {
        const studentData = {
            student: {
                id: 6,
                firstName: "Frank",
                lastName: "Castle",
                progress: 10,
                currentPartIndex: 0,
                currentQuestionIndex: 0,
                resultsByPart: {},
            },
        };
        instance.updateData(studentData);

        const card = instance.cards.get(6);
        const folded = card.el.querySelector(".folded-area");

        // Force to 'none'
        folded.style.display = "none";

        // Click directly on the folded area
        // This triggers the 'true' branch of the condition: if (e.target.classList.contains("folded-area")) return;
        folded.click();

        // It should still be 'none' because the function returned early
        expect(folded.style.display).toBe("none");
    });

    it("creates a new student card if it doesn't exist", () => {
        const studentData = {
            student: {
                id: 1,
                firstName: "Alice",
                lastName: "Smith",
                progress: 50,
                currentPartIndex: 0,
                currentQuestionIndex: 0,
                resultsByPart: {},
            },
        };

        instance.updateData(studentData);

        const card = instance.cards.get(1);
        expect(card).not.toBeNull();

        const text = card.el.querySelector(".student-name").textContent;
        expect(text).toBe("Alice S.");

        const fill = card.el.querySelector(".progress-fill");
        expect(fill.style.width).toBe("50%");

        const folded = card.el.querySelector(".folded-area");
        expect(folded).not.toBeNull();
    });

    it("handles missing last name", () => {
        const studentData = {
            student: {
                id: 1,
                firstName: "Alice",
                lastName: null,
                progress: 50,
                currentPartIndex: 0,
                currentQuestionIndex: 0,
                resultsByPart: {},
            },
        };

        instance.updateData(studentData);

        const card = instance.cards.get(1);
        const text = card.el.querySelector(".student-name").textContent;
        expect(text).toBe("Alice");
    });

    it("updates an existing student card progress", () => {
        const studentData = {
            student: {
                id: 2,
                firstName: "Bob",
                lastName: "Jones",
                progress: 30,
                currentPartIndex: 0,
                currentQuestionIndex: 0,
                resultsByPart: {},
            },
        };
        instance.updateData(studentData);

        const updatedData = {
            student: {
                id: 2,
                firstName: "Bob",
                lastName: "Jones",
                progress: 80,
                currentPartIndex: 0,
                currentQuestionIndex: 0,
                resultsByPart: {},
            },
        };
        instance.updateData(updatedData);

        const card = instance.cards.get(2);
        const fill = card.el.querySelector(".progress-fill");
        expect(fill.style.width).toBe("80%");
    });

    it("toggles folded area when card is clicked", () => {
        const studentData = {
            student: {
                id: 4,
                firstName: "Diana",
                lastName: "Prince",
                progress: 100,
                currentPartIndex: 0,
                currentQuestionIndex: 0,
                resultsByPart: {},
            },
        };
        instance.updateData(studentData);

        const card = instance.cards.get(4);
        const folded = card.el.querySelector(".folded-area");
        const arrowSpan = card.el.querySelector("#foldout-arrow");

        // Initially folded
        expect(folded.style.display === "" || folded.style.display === "none").toBe(
            true,
        );
        const initialArrowClass = arrowSpan.className;

        // Click to unfold
        console.log("ARROWSPAN1", arrowSpan.innerHTML);
        card.el.click();
        expect(folded.style.display).toBe("flex");
        console.log("ARROWSPAN2", arrowSpan.innerHTML);
        expect(arrowSpan.className).not.toBe(initialArrowClass);

        // Click to fold again
        card.el.click();
        expect(folded.style.display).toBe("none");
        expect(arrowSpan.className).toBe(initialArrowClass);
    });
});

describe("TeacherView _initFilterButtonSelection", () => {
    let socket;

    beforeEach(() => {
        vi.useFakeTimers();
        global.localStorage = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            clear: vi.fn(),
        };

        document.body.innerHTML = `
            <div class="group-test-header">
                <button class="btn" id="btn1">Filter 1</button>
                <button class="btn" id="btn2">Filter 2</button>
                <button class="btn" id="btn3">Filter 3</button>
            </div>
        `;

        socket = {
            addEventListener: vi.fn(),
            send: vi.fn(),
        };

        const wsGetter = () => socket;

        // Minimal test data
        const testData = { parts: [] };

        new TeacherView(
            testData,
            1,
            wsGetter,
            new EventTable(testData),
            new ActionButtons(),
            new NoteField(),
            new QuestionView(),
        );
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("adds click listeners to filter buttons and toggles selection", () => {
        const buttons = document.querySelectorAll(".group-test-header .btn");

        // Initially, no button has 'selected'
        buttons.forEach((btn) => {
            expect(btn.classList.contains("selected")).toBe(false);
        });

        // Click first button
        buttons[0].click();
        expect(buttons[0].classList.contains("selected")).toBe(true);
        expect(buttons[1].classList.contains("selected")).toBe(false);
        expect(buttons[2].classList.contains("selected")).toBe(false);

        // Click second button
        buttons[1].click();
        expect(buttons[1].classList.contains("selected")).toBe(true);
        expect(buttons[0].classList.contains("selected")).toBe(false);
        expect(buttons[2].classList.contains("selected")).toBe(false);

        // Click third button
        buttons[2].click();
        expect(buttons[2].classList.contains("selected")).toBe(true);
        expect(buttons[0].classList.contains("selected")).toBe(false);
        expect(buttons[1].classList.contains("selected")).toBe(false);
    });
});

describe("TeacherView socket 'test.started' handling", () => {
    let socket;
    let wsGetter;
    let view;
    let p2pChannel;
    const studentId = 123;

    beforeEach(() => {
        vi.useFakeTimers();
        global.localStorage = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            clear: vi.fn(),
        };

        document.body.innerHTML = GROUP_DOM_HTML;

        socket = {
            addEventListener: vi.fn(),
            send: vi.fn(),
            readyState: 1,
        };

        wsGetter = vi.fn().mockReturnValue(socket);

        const elapsedTimeView = new ElapsedTimeView("#elapsed-time");

        view = new TeacherView(
            {
                testType: "group",
                parts: [
                    {
                        name: "part1",
                        questions: [{}],
                    },
                ],
            }, // minimal test data
            1,
            wsGetter,
            new EventTable(),
            new ActionButtons(),
            new NoteField(),
            new QuestionView(),
            elapsedTimeView,
            null,
        );

        const mainSocketHandler = socket.addEventListener.mock.calls.find(
            (c) => c[0] === "message",
        )[1];
        mainSocketHandler({
            data: JSON.stringify({
                event: "student.joined",
                studentId: studentId,
                assignmentId: 1,
            }),
        });

        [p2pChannel] = view.studentChannels[studentId];
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("calls groupTestContainer.updateData when 'test.started' message is received", () => {
        const spy = vi.spyOn(view.groupTestContainer, "updateData");

        // simulate 'test.started' message
        const messageData = {
            event: "test.started",
            student: {
                id: 1,
                firstName: "Alice",
                lastName: "Smith",
                progress: 0,
                currentPartIndex: 0,
                currentQuestionIndex: 0,
                resultsByPart: {},
            },
        };

        p2pChannel.dispatchEvent(
            new CustomEvent("message", {
                detail: messageData,
            }),
        );

        expect(spy).toHaveBeenCalledWith(messageData);
    });

    it("Starts the timer when 'test.started' message is received", () => {
        const spy = vi.spyOn(view.elapsedTimeView, "start");

        // simulate 'test.started' message
        const messageData = {
            event: "test.started",
            student: {
                id: 1,
                firstName: "Alice",
                lastName: "Smith",
                progress: 0,
                currentPartIndex: 0,
                currentQuestionIndex: 0,
                resultsByPart: {},
            },
        };

        // Send two test.started events (simulating two students)
        p2pChannel.dispatchEvent(
            new CustomEvent("message", {
                detail: messageData,
            }),
        );
        p2pChannel.dispatchEvent(
            new CustomEvent("message", {
                detail: messageData,
            }),
        );

        // Validate that the timer is only started ONCE
        expect(spy).toHaveBeenCalledOnce();
    });

    it("sends a paused message to newly joined students when the test is paused", () => {
        const spy = vi.spyOn(view, "sendTestPaused");

        // Arrange: the test is currently paused
        view.testPaused = true;

        // simulate a 'test.started' message from a newly joined student
        const messageData = {
            event: "test.started",
            student: {
                id: 1,
                firstName: "Alice",
                lastName: "Smith",
                progress: 0,
                currentPartIndex: 0,
                currentQuestionIndex: 0,
                resultsByPart: {},
            },
        };

        p2pChannel.dispatchEvent(
            new CustomEvent("message", {
                detail: messageData,
            }),
        );

        // Assert: the newly joined student is told the test is paused
        expect(spy).toHaveBeenCalled();
    });

    it("marks a student's card as paused/resumed on 'test.paused'/'test.resumed'", () => {
        const markSpy = vi.spyOn(view.groupTestContainer, "markPause");

        // A student must exist before it can be paused
        const student = {
            id: 1,
            firstName: "Alice",
            lastName: "Smith",
            progress: 0,
            currentPartIndex: 0,
            currentQuestionIndex: 0,
            resultsByPart: {},
        };
        p2pChannel.dispatchEvent(
            new CustomEvent("message", {
                detail: { event: "test.started", student },
            }),
        );

        p2pChannel.dispatchEvent(
            new CustomEvent("message", {
                detail: { event: "test.paused", student },
            }),
        );
        expect(markSpy).toHaveBeenCalledWith(expect.anything(), true);

        p2pChannel.dispatchEvent(
            new CustomEvent("message", {
                detail: { event: "test.resumed", student },
            }),
        );
        expect(markSpy).toHaveBeenCalledWith(expect.anything(), false);
    });
});

describe("EventTable", () => {
    let individualTest;
    let table;

    beforeEach(() => {
        // Set up a standard DOM for the table
        document.body.innerHTML = INDIVIDUAL_DOM_HTML;

        // Mock out "preload" functionality
        vi.spyOn(Test.prototype, "preload").mockResolvedValue(new Map());

        individualTest = new Test(individualTestData);
        table = new EventTable(individualTest);
    });

    it("stores answer when receiving `question.answered`", () => {
        const data = {
            event: "question.answered",
            partIndex: 0,
            questionIndex: 0,
        };
        table.updateTable(data);
        expect(table.prevAnswer).toEqual(data);
    });

    it("adds another row when receiving `question.feedback`", () => {
        const data = {
            event: "question.feedback",
            partIndex: 0,
            questionIndex: 0,
        };
        table.updateTable(data);
        const rows = document.querySelectorAll("#events tbody tr");
        expect(rows.length).toBe(1);
        expect(rows[0].cells[0].textContent).not.toBeNull();
    });

    it("returns early and does not throw if eventsEl is null", () => {
        // 1. Setup: Clear the body so document.querySelector returns null
        document.body.innerHTML = "";

        table = new EventTable(individualTest);

        // 2. Verify state: eventsEl should be null
        expect(table.eventsEl).toBeNull();

        // 3. Act & Assert: This should not throw an error
        expect(() => {
            table.updateTable({ event: "question.feedback" });
        }).not.toThrow();
    });

    it("only responds to relevant events", () => {
        // Send irrelevant event
        const data = { event: "irrelevant.event" };
        expect(() => {
            table.updateTable(data);
        }).not.toThrow();
    });

    it("does not add table rows for practice questions", () => {
        const data = { event: "question.feedback", practice: true };
        table.updateTable(data);
        const rows = table.eventsEl.querySelector("tbody tr");
        expect(rows).toBeNull();
    });

    it("renders an audio player when recordingBase64 is present", () => {
        // Allow test to override `duration` of `audio` HTML element
        Object.defineProperty(global.window.HTMLMediaElement.prototype, "duration", {
            configurable: true,
            get() {
                return this._duration;
            },
            set(value) {
                this._duration = value;
            },
        });

        const data = {
            recordingBase64: "data:audio/wav;base64,UklGR...",
            partIndex: 0,
            questionIndex: 0,
        };

        table.updateTable({ event: "question.answered", ...data });
        table.updateTable({ event: "question.feedback", ...data });

        const answerCell = document.querySelector("td.answer");
        const uiEl = answerCell.querySelector("div.audio");
        const playBtnEl = answerCell.querySelector("i.ph-play");
        const durationEl = answerCell.querySelector("span");
        const audioEl = answerCell.querySelector("audio");

        // Mock that our audio data has a valid duration
        audioEl.duration = 42; // seconds

        expect(uiEl).not.toBeNull();
        expect(playBtnEl).not.toBeNull();
        expect(durationEl).not.toBeNull();
        expect(audioEl).not.toBeNull();

        // Test initial UI state
        expect(uiEl.classList).not.toContain("playing");
        expect(audioEl.src).toBe(data.recordingBase64);
        expect(audioEl.controls).toBeFalsy();

        // Dispatch events that normally occur as soon as the audio data has loaded
        audioEl.dispatchEvent(new Event("loadedmetadata"));
        audioEl.dispatchEvent(new Event("canplay"));
        // Test UI state after audio has loaded
        expect(durationEl.innerText).toContain("00:42");

        // Test UI state when playing
        playBtnEl.dispatchEvent(new Event("click"));
        expect(uiEl.classList).toContain("playing");

        // Test UI state when audio is done playing
        audioEl.dispatchEvent(new Event("ended"));
        expect(uiEl.classList).not.toContain("playing");
    });

    it("updates the audio element duration after a timeout of 250ms", () => {
        vi.useFakeTimers();

        const spyUpdate = vi.spyOn(table, "updateAudioDuration");
        table.createAudioEl("data:audio/wav;base64,UklGR...");
        vi.advanceTimersByTime(250);
        expect(spyUpdate).toHaveBeenCalled();

        vi.useRealTimers();
    });

    it("renders textAnswer when no audio is present", () => {
        const data = {
            textAnswer: "This is my answer",
            partIndex: 0,
            questionIndex: 0,
        };

        table.updateTable({ event: "question.answered", ...data });
        table.updateTable({ event: "question.feedback", ...data });

        const answerCell = document.querySelector("td.answer");
        expect(answerCell.textContent).toBe("This is my answer");
    });

    it("renders choiceId when neither audio nor textAnswer is present", () => {
        const data = {
            choiceId: "option_a",
            partIndex: 0,
            questionIndex: 0,
        };

        table.updateTable({ event: "question.answered", ...data });
        table.updateTable({ event: "question.feedback", ...data });

        const answerCell = document.querySelector("td.answer");
        expect(answerCell.textContent).toBe("option_a");
    });

    it("renders result and note cells when `question.feedback` event is received", () => {
        const data = {
            partIndex: 0,
            questionIndex: 0,
        };
        const expectedLabels = [
            { correctness: "correct", label: "Korrekt", href: "#correct" },
            { correctness: "wrong", label: "Forkert", href: "#wrong" },
            { correctness: "skipped", label: "Sprunget over", href: "#skipped" },
        ];

        for (const item of expectedLabels) {
            table.updateTable({ event: "question.answered", ...data });
            table.updateTable({
                event: "question.feedback",
                correctness: item.correctness,
                note: "Et notat",
                ...data,
            });

            const button = document.querySelector("td.result button");
            expect(button.textContent).toBe(item.label);
            const noteInput = document.querySelector("td.note input[type='text']");
            expect(noteInput.value).toBe("Et notat");

            // Test that result can be revised by using the dropdown menu
            const dropdownItem = document.querySelector(
                `td.result a[href='${item.href}']`,
            );
            dropdownItem.dispatchEvent(new Event("click"));
            expect(button.textContent).toBe(item.label);
        }
    });

    it("dispatches 'questionFeedbackEdited' event when row values are changed", () => {
        // Arrange: add row to table
        const data = {
            partIndex: 0,
            questionIndex: 0,
        };
        table.updateTable({ event: "question.answered", ...data });
        table.updateTable({
            event: "question.feedback",
            correctness: "skipped",
            note: "Et notat",
            ...data,
        });
        // Assert: add event listener verifying event data
        table.addEventListener("questionFeedbackEdited", (evt) => {
            expect(evt.detail).not.toBeUndefined();
            expect(evt.detail.correctness).toBe("wrong");
            expect(evt.detail.note).toBe("En anden værdi");
            expect(evt.actualPronunciation.note).toBe("En anden værdi");
        });
        // Arrange: edit value of each relevant form element
        for (const selector of [
            "td.result button",
            "td.result input",
            "td.note input",
        ]) {
            const elem = document.querySelector(selector);
            if (elem.tagName === "button") {
                elem.dataset.correctness = "wrong";
            } else {
                elem.value = "En anden værdi";
            }
            // Act: dispatch 'blur' event on the user-editable fields on the new row
            elem.dispatchEvent(new Event("blur"));
        }
    });

    it("renders question cells for non-practice questions", () => {
        const data = {
            partIndex: 0,
            questionIndex: 0,
        };

        table.updateTable({ event: "question.feedback", practice: false, ...data });

        const numberEl = document.querySelector("td.question span:not(.challenge)");
        expect(numberEl.textContent).toBe("1.");
        const challengeEl = document.querySelector("td.question span.challenge");
        expect(challengeEl.textContent).toBe("s");
    });
});

describe("EventTable audio element", () => {
    let individualTest;
    let table;
    let data;
    let answerCell;
    let uiEl;
    let playBtnEl;
    let audioEl;
    let durationEl;
    let currentTime;

    beforeEach(() => {
        // Set up a standard DOM for the table
        document.body.innerHTML = INDIVIDUAL_DOM_HTML;

        // Mock out "preload" functionality
        vi.spyOn(Test.prototype, "preload").mockResolvedValue(new Map());

        individualTest = new Test(individualTestData);
        table = new EventTable(individualTest);

        data = {
            recordingBase64: "data:audio/wav;base64,UklGR...",
            partIndex: 0,
            questionIndex: 0,
        };

        table.updateTable({ event: "question.answered", ...data });
        table.updateTable({ event: "question.feedback", ...data });

        answerCell = document.querySelector("td.answer");
        uiEl = answerCell.querySelector("div.audio");
        playBtnEl = answerCell.querySelector("i");
        audioEl = answerCell.querySelector("audio");
        durationEl = answerCell.querySelector("span");

        let playing = false;
        Object.defineProperty(audioEl, "paused", { get: () => !playing });
        audioEl.play = vi.fn(() => {
            playing = true;
        });
        audioEl.pause = vi.fn(() => {
            playing = false;
        });

        currentTime = 3;
        Object.defineProperty(audioEl, "currentTime", { get: () => currentTime });

        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("toggles to pause icon and adds 'playing' class when play is clicked", () => {
        audioEl.dispatchEvent(new Event("canplay"));

        // Initially shows play icon
        expect(playBtnEl.classList.contains("ph-play")).toBe(true);
        expect(playBtnEl.classList.contains("ph-pause")).toBe(false);

        // Click play
        playBtnEl.dispatchEvent(new Event("click"));
        expect(playBtnEl.classList.contains("ph-pause")).toBe(true);
        expect(playBtnEl.classList.contains("ph-play")).toBe(false);
        expect(uiEl.classList.contains("playing")).toBe(true);
    });

    it("toggles back to play icon and removes 'playing' class when pause is clicked", () => {
        audioEl.dispatchEvent(new Event("canplay"));

        // Click play, then pause
        playBtnEl.dispatchEvent(new Event("click"));
        expect(uiEl.classList.contains("playing")).toBe(true);

        playBtnEl.dispatchEvent(new Event("click"));
        expect(playBtnEl.classList.contains("ph-play")).toBe(true);
        expect(playBtnEl.classList.contains("ph-pause")).toBe(false);
        expect(uiEl.classList.contains("playing")).toBe(false);
    });

    it("restores play icon and removes 'playing' class when audio ends", () => {
        audioEl.dispatchEvent(new Event("canplay"));
        playBtnEl.dispatchEvent(new Event("click"));
        expect(uiEl.classList.contains("playing")).toBe(true);

        // Simulate audio finishing
        audioEl.dispatchEvent(new Event("ended"));
        expect(playBtnEl.classList.contains("ph-play")).toBe(true);
        expect(playBtnEl.classList.contains("ph-pause")).toBe(false);
        expect(uiEl.classList.contains("playing")).toBe(false);
    });

    it("updates the timer while audio is playing", () => {
        audioEl.dispatchEvent(new Event("canplay"));
        playBtnEl.dispatchEvent(new Event("click"));

        vi.advanceTimersByTime(250);
        expect(durationEl.innerText).toContain("03");
    });

    it("stops updating the timer when audio is paused", () => {
        audioEl.dispatchEvent(new Event("canplay"));

        // Play and let the timer tick
        playBtnEl.dispatchEvent(new Event("click"));
        vi.advanceTimersByTime(250);
        const textWhilePlaying = durationEl.innerText;

        // Pause and advance time further
        currentTime = 99;
        playBtnEl.dispatchEvent(new Event("click"));
        vi.advanceTimersByTime(250);

        // Timer should NOT have updated after pause
        expect(durationEl.innerText).toBe(textWhilePlaying);
    });
});

describe("StudentCard", () => {
    let mockStudent;
    let mockTest;

    beforeEach(() => {
        document.body.innerHTML = GROUP_DOM_HTML;

        mockStudent = new Student({
            id: 1,
            firstName: "John",
            lastName: "Doe",
        });

        mockStudent.progress = 45;
        mockStudent.currentPartIndex = 0;
        mockStudent.currentQuestionIndex = 1;
        mockStudent.resultsByPart = { 0: ["correct", "wrong", "partial"] };

        mockTest = {
            parts: [
                { name: "wordreading", questions: [{}, {}, {}, {}] },
                { name: "wordspelling", questions: [{}, {}] },
            ],
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // Pretend the dots-container is laid out so that dots have a fixed size and
    // the container has a fixed width. jsdom has no layout engine, so without
    // this _updateDotsHeight() always early-returns on a zero width.
    const stubDotsLayout = (card, { containerWidth, dotSize, gap }) => {
        Object.defineProperty(card.dotsContainer, "clientWidth", {
            value: containerWidth,
            configurable: true,
        });
        vi.spyOn(window, "getComputedStyle").mockReturnValue({
            rowGap: `${gap}px`,
        });
        vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
            width: dotSize,
            height: dotSize,
        });
    };

    it("initializes with correct student name and progress", () => {
        const card = new StudentCard(mockStudent, mockTest);

        expect(card.nameText.textContent).toBe("John D.");
        card.update();
        expect(card.progressFill.style.width).toBe("45%");
    });

    it("toggles the 'is-expanded' class and display style when clicked", () => {
        const card = new StudentCard(mockStudent, mockTest);

        expect(card.foldedArea.style.display).toBe("none");

        card.el.click();
        expect(card.foldedArea.style.display).toBe("flex");
        expect(card.el.classList.contains("is-expanded")).toBe(true);
        expect(card.arrowIcon.className).toBe("ph-fill ph-caret-up");

        card.el.click();
        expect(card.foldedArea.style.display).toBe("none");
        expect(card.el.classList.contains("is-expanded")).toBe(false);
    });

    it("changes viewable part when navigation arrows are clicked", () => {
        const card = new StudentCard(mockStudent, mockTest);
        card.update();

        expect(card.currentViewPartIndex).toBe(0);
        expect(card.partLabel.textContent).toBe("wordreading");

        card.subTestRightArrow.click();
        expect(card.currentViewPartIndex).toBe(1);
        expect(card.partLabel.textContent).toBe("wordspelling");

        card.subTestLeftArrow.click();
        expect(card.currentViewPartIndex).toBe(0);
    });

    it("renders the correct number of dots for the current part", () => {
        const card = new StudentCard(mockStudent, mockTest);
        card.update();

        const dots = card.dotsContainer.querySelectorAll(".dot");
        expect(dots.length).toBe(4);

        expect(dots[0].classList.contains("correct")).toBe(true);
        expect(dots[1].classList.contains("wrong")).toBe(true);
        expect(dots[2].classList.contains("partially-correct")).toBe(true);
        expect(dots[3].classList.contains("default")).toBe(true);
    });

    it("disables navigation arrows at the boundaries", () => {
        const card = new StudentCard(mockStudent, mockTest);

        card.update();
        expect(card.subTestLeftArrow.classList.contains("disabled")).toBe(true);
        expect(card.subTestRightArrow.classList.contains("disabled")).toBe(false);

        card.changePart(1);
        expect(card.subTestRightArrow.classList.contains("disabled")).toBe(true);
        expect(card.subTestLeftArrow.classList.contains("disabled")).toBe(false);
    });

    it("renders part segments with correct completion classes", () => {
        mockStudent.currentPartIndex = 1;
        const card = new StudentCard(mockStudent, mockTest);
        card.update();

        const segments = card.partsProgress.querySelectorAll(".part-segment");
        expect(segments.length).toBe(2);

        expect(segments[0].classList.contains("completed")).toBe(true);
    });

    it("shows '-' for question index when viewing a part the student hasn't reached yet", () => {
        const card = new StudentCard(mockStudent, mockTest);

        card.changePart(1);

        expect(card.questionIndex.textContent).toContain("-/2");
    });

    it("reserves dots-container height for the testpart with the most dots", () => {
        mockTest.parts = [
            { name: "many", questions: Array.from({ length: 12 }, () => ({})) },
            { name: "few", questions: [{}, {}] },
        ];
        const card = new StudentCard(mockStudent, mockTest);
        stubDotsLayout(card, { containerWidth: 70, dotSize: 10, gap: 5 });

        card.update();

        // dotsPerRow = floor((70 + 5) / (10 + 5)) = 5
        // rows for the biggest part = ceil(12 / 5) = 3
        // height = 3 * 10 + (3 - 1) * 5 = 40
        expect(card.dotsContainer.style.minHeight).toBe("40px");
    });

    it("keeps the same dots-container height when switching to a smaller part", () => {
        mockTest.parts = [
            { name: "many", questions: Array.from({ length: 12 }, () => ({})) },
            { name: "few", questions: [{}, {}] },
        ];
        const card = new StudentCard(mockStudent, mockTest);
        stubDotsLayout(card, { containerWidth: 70, dotSize: 10, gap: 5 });

        card.update();
        const heightOnBigPart = card.dotsContainer.style.minHeight;

        // Navigate to the part with only two dots.
        card.changePart(1);

        expect(card.dotsContainer.querySelectorAll(".dot").length).toBe(2);
        expect(card.dotsContainer.style.minHeight).toBe(heightOnBigPart);
        expect(card.dotsContainer.style.minHeight).toBe("40px");
    });

    it("allows marking and unmarking a student", () => {
        const card = new StudentCard(mockStudent, mockTest);
        card.markBtn.click();

        expect(card.student.marked).toBe(true);
        expect(card.markedStudentsCount.innerHTML).toBe("1");

        card.markBtn.click();

        expect(card.student.marked).toBe(false);
        expect(card.markedStudentsCount.innerHTML).toBe("0");
    });

    it("sets up a ResizeObserver on the folded area", () => {
        const card = new StudentCard(mockStudent, mockTest);
        expect(card.resizeObserver.observe).toHaveBeenCalledWith(card.foldedArea);
    });

    it("calls _updateDotsHeight via ResizeObserver when folded area is visible", () => {
        const card = new StudentCard(mockStudent, mockTest);
        const spy = vi.spyOn(card, "_updateDotsHeight");

        // We expect _updateDotsHeight to be called when the window is resized AND
        // The card is folded out
        card.foldedArea.style.display = "flex";
        resizeObserverCallback();
        expect(spy).toHaveBeenCalledTimes(1);

        // When the card is not folded out. Nothing should happen.
        card.foldedArea.style.display = "none";
        resizeObserverCallback();
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it("shows the pause overlay when paused before the test is complete", () => {
        const card = new StudentCard(mockStudent, mockTest);
        mockStudent.progress = 45;

        card.pause();

        expect(card.pauseOverlay.style.display).toBe("flex");
    });

    it("does not show the pause overlay when the student has finished", () => {
        const card = new StudentCard(mockStudent, mockTest);
        mockStudent.progress = 100;

        card.pause();

        expect(card.pauseOverlay.style.display).toBe("");
    });

    it("hides the pause overlay on resume", () => {
        const card = new StudentCard(mockStudent, mockTest);
        mockStudent.progress = 45;
        card.pause();
        expect(card.pauseOverlay.style.display).toBe("flex");

        card.resume();

        expect(card.pauseOverlay.style.display).toBe("none");
    });
});

describe("TeacherView Sync Logic", () => {
    let socket;
    let wsGetter;
    let view;
    let serverOnlineMock;

    beforeEach(async () => {
        vi.useFakeTimers();

        const utils = await import("../../screening/utils.js");
        serverOnlineMock = vi.mocked(utils.serverOnline);

        socket = {
            addEventListener: vi.fn(),
            send: vi.fn(),
            readyState: 1, // OPEN
        };
        wsGetter = vi.fn().mockReturnValue(socket);

        view = new TeacherView(
            { parts: [] },
            1,
            wsGetter,
            new EventTable(),
            new ActionButtons(),
            new NoteField(),
            new QuestionView(),
        );
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    describe("_startSyncInterval", () => {
        it("triggers _flushMessageQueue every second", () => {
            const flushSpy = vi.spyOn(view, "_flushMessageQueue");

            vi.advanceTimersByTime(1000);
            expect(flushSpy).toHaveBeenCalledTimes(1);

            vi.advanceTimersByTime(1000);
            expect(flushSpy).toHaveBeenCalledTimes(2);
        });
    });

    describe("_flushMessageQueue", () => {
        it("does nothing if the queue is empty", async () => {
            view.messageQueue = [];
            serverOnlineMock.mockResolvedValue(true);

            await view._flushMessageQueue();

            expect(socket.send).not.toHaveBeenCalled();
        });

        it("sends all messages in queue and clears it when online", async () => {
            // Setup queue
            const msg1 = { event: "test", id: 1 };
            const msg2 = { event: "test", id: 2 };
            view.messageQueue = [msg1, msg2];

            serverOnlineMock.mockResolvedValue(true);
            const persistSpy = vi.spyOn(view, "_persistQueue");

            await view._flushMessageQueue();

            // Verify WebSocket behavior
            expect(socket.send).toHaveBeenCalledTimes(2);
            expect(socket.send).toHaveBeenNthCalledWith(1, JSON.stringify(msg1));
            expect(socket.send).toHaveBeenNthCalledWith(2, JSON.stringify(msg2));

            // Verify queue state
            expect(view.messageQueue.length).toBe(0);
            expect(persistSpy).toHaveBeenCalled();
        });

        it("keeps messages in queue if server is offline", async () => {
            view.messageQueue = [{ event: "test" }];
            serverOnlineMock.mockResolvedValue(false);

            await view._flushMessageQueue();

            expect(socket.send).not.toHaveBeenCalled();
            expect(view.messageQueue.length).toBe(1);
        });

        it("attempts to reconnect if socket is CLOSED", async () => {
            socket.readyState = 3; // CLOSED
            const initSpy = vi.spyOn(view, "_initSocket");

            await view._flushMessageQueue();

            expect(initSpy).toHaveBeenCalled();
            expect(socket.send).not.toHaveBeenCalled();
        });

        it("waits if socket is CONNECTING", async () => {
            socket.send.mockClear();
            serverOnlineMock.mockClear();
            socket.readyState = 0; // CONNECTING

            await view._flushMessageQueue();

            expect(socket.send).not.toHaveBeenCalled();
            expect(serverOnlineMock).not.toHaveBeenCalled();
        });

        it("keeps messages in storage if sending fails", async () => {
            view.messageQueue = [{ event: "fail" }];
            serverOnlineMock.mockResolvedValue(true);

            // Force an error on send
            socket.send.mockImplementation(() => {
                throw new Error("Network Error");
            });

            await view._flushMessageQueue();

            // Queue should still contain the message
            expect(view.messageQueue.length).toBe(1);
        });
    });
});

describe("TeacherView _initSocket", () => {
    let socket;
    let wsGetter;
    let view;
    const studentId = 88;

    beforeEach(() => {
        vi.useFakeTimers();

        socket = {
            addEventListener: vi.fn(),
            send: vi.fn(),
        };
        wsGetter = vi.fn().mockReturnValue(socket);

        view = new TeacherView({ parts: [] }, 1, wsGetter);
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it("attaches the message listener to the WebSocket", () => {
        expect(socket.addEventListener).toHaveBeenCalledWith(
            "message",
            expect.any(Function),
        );
    });

    it("instantiates a new channel when a student offer arrives for the first time", () => {
        const socketHandler = socket.addEventListener.mock.calls.find(
            (c) => c[0] === "message",
        )[1];

        socketHandler({
            data: JSON.stringify({
                event: "student.joined",
                studentId,
                assignmentId: 1,
            }),
        });

        // Now WebRTCChannel is defined because of the import
        expect(WebRTCChannel).toHaveBeenCalledTimes(1);
        expect(view.studentChannels[studentId]).toHaveLength(1);
    });

    it("keeps both channels if a student joins from another window", () => {
        const socketHandler = socket.addEventListener.mock.calls.find(
            (c) => c[0] === "message",
        )[1];

        // First offer
        socketHandler({
            data: JSON.stringify({
                event: "student.joined",
                studentId,
                assignmentId: 1,
            }),
        });
        const [oldChannel] = view.studentChannels[studentId];

        // Second offer for same student
        socketHandler({
            data: JSON.stringify({
                event: "student.joined",
                studentId,
                assignmentId: 1,
            }),
        });

        expect(WebRTCChannel).toHaveBeenCalledTimes(2);
        // We cannot tell which window the student is in, so the old channel stays.
        // Sending messages to a dead channel is not a dealbreaker. We would rather
        // Send too many messages than too few.
        expect(oldChannel.peer.destroy).not.toHaveBeenCalled();
        expect(view.studentChannels[studentId]).toHaveLength(2);
    });

    it("drops only the channel that hung up", () => {
        const socketHandler = socket.addEventListener.mock.calls.find(
            (c) => c[0] === "message",
        )[1];
        const join = () =>
            socketHandler({
                data: JSON.stringify({
                    event: "student.joined",
                    studentId,
                    assignmentId: 1,
                }),
            });
        join();
        join();
        const [oldChannel, newChannel] = view.studentChannels[studentId];

        // The window behind the first channel was closed or taken over
        oldChannel.dispatchEvent(new Event("close"));

        expect(view.studentChannels[studentId]).toEqual([newChannel]);
        expect(oldChannel.close).toHaveBeenCalled();
        expect(newChannel.close).not.toHaveBeenCalled();
    });

    it("ignores WebSocket messages that are not student.joined", () => {
        const socketHandler = socket.addEventListener.mock.calls.find(
            (c) => c[0] === "message",
        )[1];

        socketHandler({
            data: JSON.stringify({ event: "ping", studentId: 99 }),
        });

        expect(WebRTCChannel).not.toHaveBeenCalled();
    });

    it("wires the P2P channel to the P2P message handler", () => {
        const p2pSpy = vi.spyOn(view, "_initP2PSocket");
        const socketHandler = socket.addEventListener.mock.calls.find(
            (c) => c[0] === "message",
        )[1];

        socketHandler({
            data: JSON.stringify({
                event: "student.joined",
                studentId,
                assignmentId: 1,
            }),
        });

        const [newChannel] = view.studentChannels[studentId];
        expect(p2pSpy).toHaveBeenCalledWith(newChannel);
    });

    it("calls p2p.connect() when the peer connection opens", () => {
        const socketHandler = socket.addEventListener.mock.calls.find(
            (c) => c[0] === "message",
        )[1];

        socketHandler({
            data: JSON.stringify({
                event: "student.joined",
                studentId: 123,
                assignmentId: 1,
            }),
        });

        const [p2p] = view.studentChannels[123];

        const openHandler = p2p.peer.on.mock.calls.find(
            (call) => call[0] === "open",
        )[1];

        expect(openHandler).toBeDefined();
        openHandler();

        expect(p2p.connect).toHaveBeenCalledTimes(1);
    });
});

describe("TeacherView messageQueue initialization", () => {
    let socket;
    let wsGetter;

    beforeEach(() => {
        vi.useFakeTimers();
        socket = { addEventListener: vi.fn(), send: vi.fn() };
        wsGetter = vi.fn().mockReturnValue(socket);

        // Ensure localStorage is clean before each test
        vi.spyOn(Storage.prototype, "getItem");
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it("initializes an empty queue if localStorage is empty", () => {
        // Path: savedQueue is null
        vi.mocked(localStorage.getItem).mockReturnValue(null);

        const view = new TeacherView({ parts: [] }, 1, wsGetter);

        expect(view.messageQueue).toEqual([]);
        expect(localStorage.getItem).toHaveBeenCalledWith(`msg_queue_1`);
    });

    it("restores the message queue if valid JSON exists in localStorage", () => {
        // Path: savedQueue contains JSON
        const mockQueue = [
            { event: "question.answered", id: 1 },
            { event: "question.displayed", id: 2 },
        ];
        vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(mockQueue));

        const view = new TeacherView({ parts: [] }, 1, wsGetter);

        expect(view.messageQueue).toEqual(mockQueue);
        expect(view.messageQueue.length).toBe(2);
    });

    it("crashes or handles gracefully if localStorage contains invalid JSON", () => {
        // Edge Case: corrupted data
        vi.mocked(localStorage.getItem).mockReturnValue("not-valid-json");

        expect(() => {
            new TeacherView({ parts: [] }, 1, wsGetter);
        }).toThrow(); // JSON.parse will throw here
    });
});

describe("GroupTestContainer Filtering", () => {
    let container;
    const test = {
        parts: [{ name: "Part 1", questions: [{}, {}] }],
    };

    beforeEach(() => {
        // Setup minimal DOM for filtering
        document.body.innerHTML = GROUP_DOM_HTML;
        container = new GroupTestContainer(test);

        this.createStudent = (id, name, progress) => ({
            student: {
                id,
                firstName: name,
                lastName: "User",
                progress: progress,
                currentPartIndex: 0,
                currentQuestionIndex: 0,
                resultsByPart: { 0: [] },
            },
        });

        container.updateData(this.createStudent(1, "Ongoing", 50));
        container.updateData(this.createStudent(2, "Finished", 100));
        container.updateData(this.createStudent(3, "Ongoing", 70));
    });

    const getDisplay = (studentId) => container.cards.get(studentId).el.style.display;

    it("shows all students when criteria is 'all'", () => {
        const btn = document.getElementById("all-students-button");
        btn.click();
        expect(getDisplay(1)).toBe("flex");
        expect(getDisplay(2)).toBe("flex");
        expect(getDisplay(3)).toBe("flex");
    });

    it("only shows students with progress < 100 when criteria is 'ongoing'", () => {
        const btn = document.getElementById("ongoing-students-button");
        btn.click();
        expect(getDisplay(1)).toBe("flex"); // 50%
        expect(getDisplay(2)).toBe("none"); // 100%
        expect(getDisplay(3)).toBe("flex"); // 10%
    });

    it("only shows students with progress === 100 when criteria is 'finished'", () => {
        const btn = document.getElementById("finished-students-button");
        btn.click();
        expect(getDisplay(1)).toBe("none");
        expect(getDisplay(2)).toBe("flex");
        expect(getDisplay(3)).toBe("none");
    });

    it("only shows marked students when criteria is 'marked'", () => {
        // Manually mark student 1
        const student1 = container.students.get(1);
        student1.marked = true;

        const btn = document.getElementById("marked-students-button");
        btn.click();

        expect(getDisplay(1)).toBe("flex");
        expect(getDisplay(2)).toBe("none");
        expect(getDisplay(3)).toBe("none");
    });

    it("updates counts correctly when new data arrives", () => {
        // Initially 3 students (2 ongoing, 1 finished)
        expect(document.getElementById("all-students-count").innerHTML).toBe("3");
        expect(document.getElementById("ongoing-students-count").innerHTML).toBe("2");
        expect(document.getElementById("finished-students-count").innerHTML).toBe("1");

        // Update student 1 to be finished
        container.updateData(this.createStudent(1, "Ongoing", 100));

        expect(document.getElementById("ongoing-students-count").innerHTML).toBe("1");
        expect(document.getElementById("finished-students-count").innerHTML).toBe("2");
    });
});

describe("DetailsPopup", () => {
    let detailsPopup;

    beforeEach(() => {
        document.body.innerHTML = INDIVIDUAL_DOM_HTML;
        detailsPopup = new DetailsPopup();
    });

    it("starts in closed state", () => {
        expect(detailsPopup.isOpen()).toBe(false);
        expect(detailsPopup.popup.hasAttribute("hidden")).toBe(true);
        expect(detailsPopup.toggle.getAttribute("aria-expanded")).toBe("false");
    });

    it("opens when toggle button is clicked", () => {
        detailsPopup.toggle.click();

        expect(detailsPopup.isOpen()).toBe(true);
        expect(detailsPopup.popup.hasAttribute("hidden")).toBe(false);
        expect(detailsPopup.toggle.getAttribute("aria-expanded")).toBe("true");
    });

    it("closes when toggle button is clicked again", () => {
        detailsPopup.toggle.click();
        expect(detailsPopup.isOpen()).toBe(true);

        detailsPopup.toggle.click();
        expect(detailsPopup.isOpen()).toBe(false);
        expect(detailsPopup.popup.hasAttribute("hidden")).toBe(true);
        expect(detailsPopup.toggle.getAttribute("aria-expanded")).toBe("false");
    });

    it("closes when clicking outside the popup", () => {
        detailsPopup.open();
        expect(detailsPopup.isOpen()).toBe(true);

        // Click on an element outside both toggle and popup
        const outside = document.getElementById("outside-element");
        outside.dispatchEvent(new Event("click", { bubbles: true }));

        expect(detailsPopup.isOpen()).toBe(false);
    });

    it("does not close when clicking inside the popup", () => {
        detailsPopup.open();

        // Click on something inside the popup
        const innerLabel = detailsPopup.popup.querySelector(".details-label");
        innerLabel.dispatchEvent(new Event("click", { bubbles: true }));

        expect(detailsPopup.isOpen()).toBe(true);
    });
});

describe("StudentPresenceIndicator", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = INDIVIDUAL_DOM_HTML;
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    it("keeps waiting until the student arrives", () => {
        const indicator = new StudentPresenceIndicator();
        vi.advanceTimersByTime(60000);
        expect(indicator.domElement.dataset.state).toBe("waiting");
    });

    it("restarts the delay when the student arrives again", () => {
        const indicator = new StudentPresenceIndicator();

        indicator.markStudentArrived();
        vi.advanceTimersByTime(4000);
        // The student re-enters the room before the confirmation is hidden
        indicator.markStudentArrived();
        vi.advanceTimersByTime(4000);
        expect(indicator.domElement.dataset.state).toBe("arrived");

        vi.advanceTimersByTime(1000);
        expect(indicator.domElement.dataset.state).toBe("done");
    });

    it("does not throw when the element is missing from the DOM", () => {
        document.body.innerHTML = "";
        const indicator = new StudentPresenceIndicator();
        expect(indicator.domElement).toBeNull();
        expect(() => indicator.markStudentArrived()).not.toThrow();
    });
});

describe("GroupTestContainer sortCards", () => {
    let container;
    const test = {
        parts: [{ name: "Part 1", questions: [{}, {}] }],
    };
    let btn;

    const createStudent = (id, firstName, lastName = "User") => ({
        student: {
            id,
            firstName,
            lastName,
            progress: 0,
            currentPartIndex: 0,
            currentQuestionIndex: 0,
            resultsByPart: {},
        },
    });

    beforeEach(() => {
        document.body.innerHTML = GROUP_DOM_HTML;
        container = new GroupTestContainer(test);

        HTMLElement.prototype.animate = vi.fn().mockReturnValue({});

        container.updateData(createStudent(1, "Søren"));
        container.updateData(createStudent(2, "Alice"));
        container.updateData(createStudent(3, "Børge"));
        btn = document.querySelector("#sort-button");
    });

    const getCardOrder = () =>
        [...container.container.children].map(
            (el) => el.querySelector(".student-name").textContent,
        );

    it("sorts cards when the sort button is clicked", () => {
        btn.click();
        expect(container.sortOrder).toBe("ascending");
        let order = getCardOrder();
        expect(order).toEqual(["Alice U.", "Børge U.", "Søren U."]);

        btn.click();
        expect(container.sortOrder).toBe("descending");
        order = getCardOrder();
        expect(order).toEqual(["Søren U.", "Børge U.", "Alice U."]);
    });

    it("calls animate on cards that changed position", () => {
        let callCount = 0;
        vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
            function () {
                // Return different positions on successive calls per element
                // so that dx/dy are non-zero
                callCount++;
                return { left: callCount * 10, top: callCount * 10 };
            },
        );

        container.sortCards();
        expect(HTMLElement.prototype.animate).toHaveBeenCalled();
    });
});

describe("GroupTestContainer setCardColumns", () => {
    let container;
    const test = {
        parts: [{ name: "Part 1", questions: [{}, {}] }],
    };
    let view2Btn;
    let view3Btn;
    let view4Btn;

    const createStudent = (id, firstName) => ({
        student: {
            id,
            firstName,
            lastName: "User",
            progress: 0,
            currentPartIndex: 0,
            currentQuestionIndex: 0,
            resultsByPart: {},
        },
    });

    beforeEach(() => {
        document.body.innerHTML = GROUP_DOM_HTML;
        container = new GroupTestContainer(test);
        container.updateData(createStudent(1, "Alice"));
        container.updateData(createStudent(2, "Bob"));

        view2Btn = document.querySelector('.view-btn[data-columns="2"]');
        view3Btn = document.querySelector('.view-btn[data-columns="3"]');
        view4Btn = document.querySelector('.view-btn[data-columns="4"]');
    });

    it("sets correct width on all cards for 4 columns", () => {
        view4Btn.click();
        container.cards.forEach((card) => {
            expect(card.el.style.width).toBe("calc(25% - 12px)");
        });
        expect(container.view4Btn.classList.contains("active")).toBe(true);
    });

    it("sets correct width on all cards for 3 columns", () => {
        view3Btn.click();
        container.cards.forEach((card) => {
            expect(card.el.style.width).toBe("calc(33.3333% - 10.6666px)");
        });
        expect(container.view3Btn.classList.contains("active")).toBe(true);
    });

    it("sets correct width on all cards for 2 columns", () => {
        view2Btn.click();
        container.cards.forEach((card) => {
            expect(card.el.style.width).toBe("calc(50% - 8px)");
        });
        expect(container.view2Btn.classList.contains("active")).toBe(true);
    });

    it("logs an error for invalid column count", () => {
        const spyError = vi.spyOn(console, "error").mockImplementation(() => {});
        container.setCardColumns(200);
        expect(spyError).toHaveBeenCalledWith("Invalid number of columns: ", 200);
    });
});

describe("GroupTestContainer foldAllCards", () => {
    let container;
    const test = {
        parts: [{ name: "Part 1", questions: [{}, {}] }],
    };
    let btn;

    const createStudent = (id, firstName) => ({
        student: {
            id,
            firstName,
            lastName: "User",
            progress: 0,
            currentPartIndex: 0,
            currentQuestionIndex: 0,
            resultsByPart: {},
        },
    });

    beforeEach(() => {
        document.body.innerHTML = GROUP_DOM_HTML;
        container = new GroupTestContainer(test);
        container.updateData(createStudent(1, "Alice"));
        container.updateData(createStudent(2, "Bob"));
        container.updateData(createStudent(3, "Carol"));
        btn = document.querySelector("#fold-all-button");
    });

    it("folds all cards out when all are folded in", () => {
        // All cards start folded in by default
        btn.click();
        container.cards.forEach((card) => {
            expect(card.foldedArea.style.display).toBe("flex");
            expect(card.isHidden).toBe(false);
        });
    });

    it("folds all cards in when all are folded out", () => {
        container.cards.forEach((card) => card.foldOut());
        btn.click();
        container.cards.forEach((card) => {
            expect(card.foldedArea.style.display).toBe("none");
            expect(card.isHidden).toBe(true);
        });
    });

    it("folds all cards in when only some are folded out", () => {
        // Open just one card — anyCardIsFoldedOut should be true
        const firstCard = container.cards.values().next().value;
        firstCard.foldOut();

        btn.click();
        container.cards.forEach((card) => {
            expect(card.foldedArea.style.display).toBe("none");
            expect(card.isHidden).toBe(true);
        });
    });
});
