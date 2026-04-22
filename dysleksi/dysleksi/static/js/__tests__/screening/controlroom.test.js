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
            this.peer = {
                on: vi.fn(),
                destroy: vi.fn(),
            };
        }),
    };
});

describe("ActionButtons", () => {
    const mockDoc = `
        <button id="correct"></button>
        <button id="wrong"></button>
        <button id="cancelled"></button>
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

        document.body.innerHTML = `
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
            </template>
            <table id="events"><tbody></tbody></table>
            <button id="correct"><span>Korrekt</span></button>
            <button id="wrong">Forkert</button>
            <button id="cancelled">Afslut test</button>
            <button id="skipped">Sprunget over</button>
            <button id="next">Næste</button>
            <textarea id="note" class="d-none"></textarea>
            <div id="audio-indicator"></div>
        `;

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
            "room1",
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

        const mainSocketHandler = socket.addEventListener.mock.calls.find(
            (c) => c[0] === "message",
        )[1];
        mainSocketHandler({
            data: JSON.stringify({ event: "student.joined", studentId }),
        });
        p2pChannel = view.studentChannels[studentId];
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("sends null for 'correct' when the skip button is clicked", () => {
        vi.spyOn(global.crypto, "randomUUID").mockReturnValue("UUID-SKIP");

        view.setPartIndex(0);
        view.setQuestionIndex(0);

        // Click the skip button
        const skipButton = buttons.skipButton();
        skipButton.click();

        expect(p2pChannel.send).toHaveBeenCalledWith({
            uuid: "UUID-SKIP",
            event: "question.feedback",
            roomName: "room1",
            partIndex: 0,
            questionIndex: 0,
            questionId: 1,
            partId: 1,
            assignmentId: 1,
            correct: null, // This hits the 'null' branch of the ternary
            note: "",
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
        // We only pass the required arguments: roomName, test, assignmentId, wsGetter
        // The rest (table, buttons, noteField, questionView) will fall back to 'new' instances
        const minimalView = new TeacherView("room1", individualTest, 1, wsGetter);

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
            "room1",
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
        expect(partNumber.innerText).toBe("Deltest 1 af 2");

        // Act: go to instruction question
        view.setQuestionIndex(0, true);
        // Assert
        expect(partName.innerText).toBe(view.test.parts[0].name);
        expect(partNumber.innerText).toBe("Deltest 1 af 2");
        expect(questionNumber.innerText).toBe("Instruktion 1 af 1");

        // Act: go to practice question
        view.setQuestionIndex(1, true);
        // Assert
        expect(partName.innerText).toBe(view.test.parts[0].name);
        expect(partNumber.innerText).toBe("Deltest 1 af 2");
        expect(questionNumber.innerText).toBe("Øveopgave 1 af 1");

        // Act: go to real question
        view.setQuestionIndex(0, false);
        // Assert
        expect(partName.innerText).toBe(view.test.parts[0].name);
        expect(partNumber.innerText).toBe("Deltest 1 af 2");
        expect(questionNumber.innerText).toBe("Opgave 1 af 3");
    });

    it("initializes socket and button listeners", () => {
        expect(wsGetter).toHaveBeenCalledWith("room1");
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
                    questionTitle: "Q1",
                    displayedAt: 1000,
                },
            }),
        );

        const btn = document.querySelector("button");
        expect(btn.classList.contains("disabled")).toBe(false);

        // trigger another question.displayed event - this time the question type is "no_input_required"
        p2pChannel.dispatchEvent(
            new CustomEvent("message", {
                detail: {
                    event: "question.displayed",
                    partIndex: 0,
                    questionIndex: 1,
                    questionTitle: "Q2",
                    displayedAt: 2000,
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
            roomName: "room1",
            partIndex: 0,
            questionIndex: 0,
            questionId: 1,
            partId: 1,
            assignmentId: 1,
            correct: false,
            note: "Test note",
        });

        expect(wrongButton.classList.contains("disabled")).toBe(true);
    });

    it("delays sending feedback if question type is 'no_input_required'", () => {
        vi.spyOn(global.crypto, "randomUUID").mockReturnValue("UUID123");

        // Arrange: go directly to question 2 (which is type "no_input_required")
        view.setPartIndex(0);
        view.setQuestionIndex(1);

        // Act: fill note and click "correct"
        note.noteEl.value = "Test note";
        buttons.correctButton().click();

        // Assert: no socket message sent yet
        expect(p2pChannel.send).not.toHaveBeenCalled();

        // Act: click "next"
        buttons.nextButton().click();

        expect(p2pChannel.send).toHaveBeenCalledWith({
            uuid: "UUID123",
            event: "question.feedback",
            roomName: "room1",
            partIndex: 0,
            questionIndex: 1,
            questionId: 2,
            partId: 1,
            assignmentId: 1,
            correct: true,
            note: "Test note",
        });
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
            roomName: "room1",
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

    it("runs animated audio indicator while the student answers", () => {
        // Arrange
        const spyStart = vi.spyOn(audioIndicator, "start");
        // Act: display non-practice question
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
        // Assert: audio indicator animation is started
        expect(spyStart).toHaveBeenCalled();
    });

    it("stops animated audio indicator when the student has answered", () => {
        // Arrange
        const spyStop = vi.spyOn(audioIndicator, "stop");
        // Act: answer non-practice question
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
        // Assert: audio indicator animation is started
        expect(spyStop).toHaveBeenCalled();
    });
});

describe("GroupTestContainer", () => {
    let instance;

    beforeEach(() => {
        document.body.innerHTML = `
            <template id="student-card-template">
                <div class="student-card">
                    <div class="student-top-row">
                        <div class="progress-fill" style="width: 0%"></div>
                        <span class="student-text"></span>
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
                            <i id="foldout-arrow" class="ph-fill ph-caret-up"></i>
                        </span>
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
            
            <button id="problem-students-button" class="btn btn-outline-primary">
              <i class="ph-fill ph-warning-circle red"></i>
              Problemer/offline (<span id="problem-students-count">0</span>)
            </button>

            <div class="group-test-body"></div>
        `;
        document.querySelector(".group-test-body");

        const test = {
            parts: [
                {
                    name: "part1",
                    questions: [{}],
                },
            ],
        };

        instance = new GroupTestContainer(test);
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
        const nameSpan = card.el.querySelector(".student-text");

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

        const text = card.el.querySelector(".student-text").textContent;
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
        const text = card.el.querySelector(".student-text").textContent;
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
            "room1",
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

        document.body.innerHTML = `

            <template id="student-card-template">
                <div class="student-card">
                    <div class="student-top-row">
                        <div class="progress-fill" style="width: 0%"></div>
                        <span class="student-text"></span>
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
                            <i id="foldout-arrow" class="ph-fill ph-caret-up"></i>
                        </span>
                    </div>
                    </div>
                    <div class="folded-area">
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
            
            <button id="problem-students-button" class="btn btn-outline-primary">
              <i class="ph-fill ph-warning-circle red"></i>
              Problemer/offline (<span id="problem-students-count">0</span>)
            </button>

            <div class="group-test-body"></div>
        `;

        socket = {
            addEventListener: vi.fn(),
            send: vi.fn(),
            readyState: 1,
        };

        wsGetter = vi.fn().mockReturnValue(socket);

        view = new TeacherView(
            "room1",
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
        );

        const mainSocketHandler = socket.addEventListener.mock.calls.find(
            (c) => c[0] === "message",
        )[1];
        mainSocketHandler({
            data: JSON.stringify({ event: "student.joined", studentId: studentId }),
        });

        p2pChannel = view.studentChannels[studentId];
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
});

describe("EventTable", () => {
    let individualTest;
    let table;

    beforeEach(() => {
        // Set up a standard DOM for the table
        document.body.innerHTML = `
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
            </template>
            <table id="events">
                <tbody></tbody>
            </table>
        `;

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
            { correct: true, label: "Korrekt", href: "#correct" },
            { correct: false, label: "Forkert", href: "#wrong" },
            { correct: null, label: "Sprunget over", href: "#skipped" },
        ];

        for (const item of expectedLabels) {
            table.updateTable({ event: "question.answered", ...data });
            table.updateTable({
                event: "question.feedback",
                correct: item.correct,
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

describe("StudentCard", () => {
    let mockStudent;
    let mockTest;

    beforeEach(() => {
        document.body.innerHTML = `
            <template id="student-card-template">
                <div class="student-card">
                    <div class="student-top-row">
                        <div class="progress-fill"></div>
                        <span class="student-text"></span>
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
                            <i id="foldout-arrow" class="ph-fill ph-caret-up"></i>
                        </span>
                    </div>
                    </div>
                    <div class="folded-area" style="display: none;">
                        <div class="parts-progress"></div>
                        <div class="part-navigation">
                            <i class="ph-caret-left"></i>
                            <span class="part-index"></span>
                            <i class="ph-caret-right"></i>
                        </div>
                        <span class="part-label"></span>
                        <span class="question-index"></span>
                        <div class="dots-container"></div>
                    </div>
                </div>
            </template>

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
            
            <button id="problem-students-button" class="btn btn-outline-primary">
              <i class="ph-fill ph-warning-circle red"></i>
              Problemer/offline (<span id="problem-students-count">0</span>)
            </button>

        `;

        mockStudent = new Student({
            id: 1,
            firstName: "John",
            lastName: "Doe",
        });

        mockStudent.progress = 45;
        mockStudent.currentPartIndex = 0;
        mockStudent.currentQuestionIndex = 1;
        mockStudent.resultsByPart = { 0: [true, false] };

        mockTest = {
            parts: [
                { name: "wordreading", questions: [{}, {}, {}] },
                { name: "wordspelling", questions: [{}, {}] },
            ],
        };
    });

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
        expect(card.arrowIcon.className).toBe("ph-fill ph-caret-down");

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
        expect(dots.length).toBe(3);

        expect(dots[0].classList.contains("correct")).toBe(true);
        expect(dots[1].classList.contains("wrong")).toBe(true);
        expect(dots[2].classList.contains("default")).toBe(true);
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

    it("allows marking and unmarking a student", () => {
        const card = new StudentCard(mockStudent, mockTest);
        card.markBtn.click();

        expect(card.student.marked).toBe(true);
        expect(card.markedStudentsCount.innerHTML).toBe("1");

        card.markBtn.click();

        expect(card.student.marked).toBe(false);
        expect(card.markedStudentsCount.innerHTML).toBe("0");
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
            "room1",
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
        it("triggers _flushMessageQueue every 5 seconds", () => {
            const flushSpy = vi.spyOn(view, "_flushMessageQueue");

            vi.advanceTimersByTime(5000);
            expect(flushSpy).toHaveBeenCalledTimes(1);

            vi.advanceTimersByTime(5000);
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

        view = new TeacherView("room1", { parts: [] }, 1, wsGetter);
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
            data: JSON.stringify({ event: "student.joined", studentId }),
        });

        // Now WebRTCChannel is defined because of the import
        expect(WebRTCChannel).toHaveBeenCalledTimes(1);
        expect(view.studentChannels[studentId]).toBeDefined();
    });

    it("creates a new channel if a student re-joins", () => {
        const socketHandler = socket.addEventListener.mock.calls.find(
            (c) => c[0] === "message",
        )[1];

        // First offer
        socketHandler({ data: JSON.stringify({ event: "student.joined", studentId }) });
        const oldChannel = view.studentChannels[studentId];

        // Second offer for same student
        socketHandler({ data: JSON.stringify({ event: "student.joined", studentId }) });

        expect(WebRTCChannel).toHaveBeenCalledTimes(2);
        expect(oldChannel.peer.destroy).toHaveBeenCalled();
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

        socketHandler({ data: JSON.stringify({ event: "student.joined", studentId }) });

        const newChannel = view.studentChannels[studentId];
        expect(p2pSpy).toHaveBeenCalledWith(newChannel);
    });

    it("calls p2p.connect() when the peer connection opens", () => {
        const socketHandler = socket.addEventListener.mock.calls.find(
            (c) => c[0] === "message",
        )[1];

        socketHandler({
            data: JSON.stringify({ event: "student.joined", studentId: 123 }),
        });

        const p2p = view.studentChannels[123];

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
    const roomName = "test-room";

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

        const view = new TeacherView(roomName, { parts: [] }, 1, wsGetter);

        expect(view.messageQueue).toEqual([]);
        expect(localStorage.getItem).toHaveBeenCalledWith(`msg_queue_${roomName}`);
    });

    it("restores the message queue if valid JSON exists in localStorage", () => {
        // Path: savedQueue contains JSON
        const mockQueue = [
            { event: "question.answered", id: 1 },
            { event: "question.displayed", id: 2 },
        ];
        vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(mockQueue));

        const view = new TeacherView(roomName, { parts: [] }, 1, wsGetter);

        expect(view.messageQueue).toEqual(mockQueue);
        expect(view.messageQueue.length).toBe(2);
    });

    it("crashes or handles gracefully if localStorage contains invalid JSON", () => {
        // Edge Case: corrupted data
        vi.mocked(localStorage.getItem).mockReturnValue("not-valid-json");

        expect(() => {
            new TeacherView(roomName, { parts: [] }, 1, wsGetter);
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
        document.body.innerHTML = `
            <template id="student-card-template">
                <div class="student-card">
                    <div class="student-top-row">
                        <div class="progress-fill"></div>
                        <span class="student-text"></span>
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
                                <i id="foldout-arrow" class="ph-fill ph-caret-up"></i>
                            </span>
                        </div>
                    </div>
                    <div class="folded-area" style="display: none;">
                        <div class="parts-progress"></div>
                        <div class="dots-container"></div>
                        <span class="part-label"></span>
                        <span class="part-index"></span>
                        <span class="question-index"></span>
                        <i class="ph-caret-left"></i>
                        <i class="ph-caret-right"></i>
                    </div>
                </div>
            </template>
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
            
            <button id="problem-students-button" class="btn btn-outline-primary">
              <i class="ph-fill ph-warning-circle red"></i>
              Problemer/offline (<span id="problem-students-count">0</span>)
            </button>
            <div class="group-test-body"></div>
        `;
        container = new GroupTestContainer(test);

        this.createStudent = (id, name, progress, problem) => ({
            student: {
                id,
                firstName: name,
                lastName: "User",
                progress: progress,
                problem: problem,
                currentPartIndex: 0,
                currentQuestionIndex: 0,
                resultsByPart: { 0: [] },
            },
        });

        container.updateData(this.createStudent(1, "Ongoing", 50, false));
        container.updateData(this.createStudent(2, "Finished", 100, false));
        container.updateData(this.createStudent(3, "Problem", 10, true));
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

    it("only shows students with problems when criteria is 'problem'", () => {
        const btn = document.getElementById("problem-students-button");
        btn.click();
        expect(getDisplay(1)).toBe("none");
        expect(getDisplay(2)).toBe("none");
        expect(getDisplay(3)).toBe("flex");
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
        // Initially 3 students (2 ongoing, 1 finished, 1 problem)
        expect(document.getElementById("all-students-count").innerHTML).toBe("3");
        expect(document.getElementById("ongoing-students-count").innerHTML).toBe("2");
        expect(document.getElementById("finished-students-count").innerHTML).toBe("1");
        expect(document.getElementById("problem-students-count").innerHTML).toBe("1");

        // Update student 1 to be finished
        container.updateData(this.createStudent(1, "Ongoing", 100, false));

        expect(document.getElementById("ongoing-students-count").innerHTML).toBe("1");
        expect(document.getElementById("finished-students-count").innerHTML).toBe("2");
    });
});
