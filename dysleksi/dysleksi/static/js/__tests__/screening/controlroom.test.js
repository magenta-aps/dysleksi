/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi, assert } from "vitest";
import {EventTable, ActionButtons, TeacherView, NoteField, QuestionView} from "../../screening/controlroom.js";
import * as groupTestData from './grouptest.json' with { type: 'json' }
import * as individualTestData from './individualtest.json' with { type: 'json' }
import {Test} from "../../screening/model";
import { GroupTestContainer } from "../../screening/controlroom.js";
import { StudentCard } from "../../screening/controlroom.js";
import { Student } from "../../screening/model.js";
import { WebRTCChannel } from "../../webRTC.js";

vi.mock("../../screening/utils.js");



vi.mock("../../webRTC.js", () => {
    return {
        WebRTCChannel: vi.fn().mockImplementation(function() {
            const target = new EventTarget();
            
            this.addEventListener = target.addEventListener.bind(target);
            this.removeEventListener = target.removeEventListener.bind(target);
            this.dispatchEvent = target.dispatchEvent.bind(target);
            
            this.connect = vi.fn();
            this.send = vi.fn();
            this.peer = {
                on: vi.fn(),
                destroy: vi.fn()
            };
        })
    };
});


describe("ActionButtons", () => {
    const mockDoc = `
        <button id="correct"></button>
        <button id="wrong"></button>
        <button id="cancelled"></button>
        <button id="skipped"></button>
        <button id="next"></button>
    `

    const getInstance = () => {
        return new ActionButtons();
    }

    const getButtons = (selector = "button") => {
        return document.querySelector(selector);
    }

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

describe("Teacher Individual test View", () => {
    let socket;
    let table;
    let buttons;
    let note;
    let questionView;
    let view;
    let wsGetter;
    let groupTest;
    let individualTest;
    let p2pHandler;
    let p2pChannel;
    const studentId = 123;

    beforeEach(() => {
        global.localStorage = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            clear: vi.fn()
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
            <table id="events"><tbody></tbody></table>
            <button id="correct"></button>
            <button id="wrong"></button>
            <button id="cancelled"></button>
            <button id="skipped"></button>
            <button id="next"></button>
            <textarea id="note" class="d-none"></textarea>
        `;
        table = new EventTable();
        buttons = new ActionButtons();
        note = new NoteField();
        questionView = new QuestionView();
        vi.spyOn(Test.prototype, 'preload').mockResolvedValue(new Map());

        groupTest = new Test(groupTestData);
        individualTest = new Test(individualTestData);

        view = new TeacherView("room1", individualTest, 1, wsGetter, table, buttons, note, questionView);

        const mainSocketHandler = socket.addEventListener.mock.calls.find(c => c[0] === "message")[1];
        mainSocketHandler({
            data: JSON.stringify({ event: 'student.joined', studentId })
        });
        p2pChannel = view.studentChannels[studentId];
    });

    afterEach(() => {
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
        p2pChannel.dispatchEvent(new CustomEvent('message', {
            detail: {
                event: "question.answered",
                partIndex: 0,
                questionIndex: 0,
                practice: false,
                answeredAt: "10:00:05"
            }}));

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
        const expectedPracticeQuestion = individualTest.parts[0].practice[practiceIndex];

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
        expect(partNumber.innerText).toBe("Deltest 1 af 1");

        // Act: go to instruction question
        view.setQuestionIndex(0, true);
        // Assert
        expect(partName.innerText).toBe(view.test.parts[0].name);
        expect(partNumber.innerText).toBe("Deltest 1 af 1");
        expect(questionNumber.innerText).toBe("Instruktion 1 af 1");

        // Act: go to practice question
        view.setQuestionIndex(1, true);
        // Assert
        expect(partName.innerText).toBe(view.test.parts[0].name);
        expect(partNumber.innerText).toBe("Deltest 1 af 1");
        expect(questionNumber.innerText).toBe("Øveopgave 1 af 1");

        // Act: go to real question
        view.setQuestionIndex(0, false);
        // Assert
        expect(partName.innerText).toBe(view.test.parts[0].name);
        expect(partNumber.innerText).toBe("Deltest 1 af 1");
        expect(questionNumber.innerText).toBe("Opgave 1 af 3");
    });

    it("initializes socket and button listeners", () => {
        expect(wsGetter).toHaveBeenCalledWith("room1");
        expect(socket.addEventListener).toHaveBeenCalledWith(
            "message",
            expect.any(Function)
        );
    });

    it("enables buttons on question.displayed", () => {
        // get the message handler registered on the socket
        const handler = socket.addEventListener.mock.calls.find(c => c[0] === "message")[1];

        // trigger a question.displayed event
        p2pChannel.dispatchEvent(new CustomEvent('message', {
            detail: {
                event: "question.displayed",
                partIndex: 0,
                questionIndex: 0,
                questionTitle: "Q1",
                displayedAt: 1000,
            }}));

        const btn = document.querySelector("button");
        expect(btn.classList.contains("disabled")).toBe(false);
    });

    it("disables 'next' button on 'question.displayed' (individual tests)", () => {

        // trigger first question.displayed event - question type is "free_text"
        p2pChannel.dispatchEvent(new CustomEvent('message', {
            detail: {
                event: "question.displayed",
                partIndex: 0,
                questionIndex: 0,
                questionTitle: "Q1",
                displayedAt: 1000,
        }}));

        const btn = document.querySelector("button");
        expect(btn.classList.contains("disabled")).toBe(false);

        // trigger another question.displayed event - this time the question type is "no_input_required"
        p2pChannel.dispatchEvent(new CustomEvent('message', {
            detail: {
                event: "question.displayed",
                partIndex: 0,
                questionIndex: 1,
                questionTitle: "Q2",
                displayedAt: 2000,
        }}));

        expect(buttons.nextButton().classList).to.include(["disabled"]);
    });

    it("show question on question.displayed", () => {

        questionView.show();
        expect(questionView.containerElement.classList.contains("d-none")).toBe(false)

        // trigger a question.displayed event
        p2pChannel.dispatchEvent(new CustomEvent('message', {
            detail: {
                event: "question.displayed",
                partIndex: 0,
                questionIndex: 0,
        }}));

        expect(questionView.titleElement.textContent).toBe("1/3 (Individuel deltest)");

        p2pChannel.dispatchEvent(new CustomEvent('message', {
            detail: {
                event: "question.displayed",
                partIndex: 0,
                questionIndex: 1,
        }}));

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

    it("raise error when incorrect partindex is received", () => {

        const invalidIndexes = [null, undefined, -1, individualTest.parts.length, individualTest.parts.length+1];
        for (const index of invalidIndexes) {
            try {
                view.validatePartIndex(index);
                assert.fail("Exception not raised for part index " + index);
            } catch (e) {
            }
        }
    });

    it("raise error when incorrect questionindex is received", () => {
        view.setPartIndex(0);

        const invalidIndexes = [null, undefined, -1, individualTest.parts[0].questions.length, individualTest.parts[0].questions.length+1];
        for (const index of invalidIndexes) {
            try {
                view.validateQuestionIndex(index);
                assert.fail("Exception not raised for question index " + index);
            } catch (e) {
            }
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
        expect(container.innerHTML).toBe('<img id="challenge-image" src="/test/image.png"><p id="challenge-text">Test content</p>');

        questionView.showContent("Test content", "/test/image2.png");
        expect(container.innerHTML).toBe('<img id="challenge-image" src="/test/image2.png"><p id="challenge-text">Test content</p>');

        questionView.showContent("Test content");
        expect(container.innerHTML).toBe('<p id="challenge-text">Test content</p>');

        questionView.showContent(null, "/test/image.png");
        expect(container.innerHTML).toBe('<img id="challenge-image" src="/test/image.png">');
    });
});




describe("GroupTestContainer", () => {
    let container;
    let instance;

    beforeEach(() => {
        document.body.innerHTML = `
            <template id="student-card-template">
                <div class="student-card">
                    <div class="student-top-row">
                        <div class="progress-fill" style="width: 0%"></div>
                        <span class="student-text"></span>
                        <span class="foldout-arrow">
                            <i class="ph-fill ph-caret-up"></i>
                        </span>
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


            <div class="group-test-body"></div>
        `;
        container = document.querySelector(".group-test-body");

        const test = { parts: [{
            name: "part1",
            questions: [{}]
        }]};

        instance = new GroupTestContainer(test);
    });




    it("toggles folded area even when clicking on child elements (name text)", () => {
        const studentData = {
            student: { id: 5, firstName: "Eve", lastName: "Online", progress: 20, currentPartIndex: 0, currentQuestionIndex: 0, resultsByPart: {} },
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
            student: { id: 6, firstName: "Frank", lastName: "Castle", progress: 10, currentPartIndex: 0, currentQuestionIndex: 0, resultsByPart: {} },
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

    it("returns early and does not throw if container is null", () => {
        // 1. Setup: Clear the body so document.querySelector(".group-test-body") returns null
        document.body.innerHTML = "";

        // 2. Initialize: The constructor will set this.container to null
        const nullInstance = new GroupTestContainer();
        expect(nullInstance.container).toBeNull();

        const studentData = {
            student: { id: 99, firstName: "Ghost", lastName: "User", progress: 0, currentPartIndex: 0, currentQuestionIndex: 0, resultsByPart: {} },
        };

        // 3. Act & Assert: Should return early without attempting to query or create elements
        expect(() => {
            nullInstance.updateData(studentData);
        }).not.toThrow();

        // Verify no cards were accidentally created in the body
        expect(document.querySelectorAll(".student-card").length).toBe(0);
    });

    it("creates a new student card if it doesn't exist", () => {
        const studentData = {
            student: { id: 1, firstName: "Alice", lastName: "Smith", progress: 50, currentPartIndex: 0, currentQuestionIndex: 0, resultsByPart: {} },
        };

        instance.updateData(studentData);

        const card = instance.cards.get(1)
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
            student: { id: 1, firstName: "Alice", lastName: null, progress: 50, currentPartIndex: 0, currentQuestionIndex: 0, resultsByPart: {} },
        };

        instance.updateData(studentData);

        const card = instance.cards.get(1)
        const text = card.el.querySelector(".student-text").textContent;
        expect(text).toBe("Alice");

    });


    it("updates an existing student card progress", () => {
        const studentData = {
            student: { id: 2, firstName: "Bob", lastName: "Jones", progress: 30, currentPartIndex: 0, currentQuestionIndex: 0, resultsByPart: {} },
        };
        instance.updateData(studentData);

        const updatedData = {
            student: { id: 2, firstName: "Bob", lastName: "Jones", progress: 80, currentPartIndex: 0, currentQuestionIndex: 0, resultsByPart: {} },
        };
        instance.updateData(updatedData);

        const card = instance.cards.get(2)
        const fill = card.el.querySelector(".progress-fill");
        expect(fill.style.width).toBe("80%");
    });


    it("toggles folded area when card is clicked", () => {
        const studentData = {
            student: { id: 4, firstName: "Diana", lastName: "Prince", progress: 100, currentPartIndex: 0, currentQuestionIndex: 0, resultsByPart: {} },
        };
        instance.updateData(studentData);

        const card = instance.cards.get(4);
        const folded = card.el.querySelector(".folded-area");
        const arrowSpan = card.el.querySelector(".foldout-arrow");

        // Initially folded
        expect(folded.style.display === "" || folded.style.display === "none").toBe(true);
        const initialArrowHTML = arrowSpan.innerHTML;

        // Click to unfold
        card.el.click();
        expect(folded.style.display).toBe("flex");
        expect(arrowSpan.innerHTML).not.toBe(initialArrowHTML);

        // Click to fold again
        card.el.click();
        expect(folded.style.display).toBe("none");
        expect(arrowSpan.innerHTML).toBe(initialArrowHTML);
    });
});


describe("TeacherView _initFilterButtonSelection", () => {
    let view;
    let socket;

    beforeEach(() => {
        global.localStorage = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            clear: vi.fn()
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

        view = new TeacherView(
            "room1",
            testData,
            1,
            wsGetter,
            new EventTable(),
            new ActionButtons(),
            new NoteField(),
            new QuestionView()
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });


    it("adds click listeners to filter buttons and toggles selection", () => {
        const buttons = document.querySelectorAll(".group-test-header .btn");

        // Initially, no button has 'selected'
        buttons.forEach(btn => {
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
    let p2pHandler;
    let p2pChannel;
    const studentId = 123;

    beforeEach(() => {
        global.localStorage = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            clear: vi.fn()
        };

        document.body.innerHTML = `

            <template id="student-card-template">
                <div class="student-card">
                    <div class="student-top-row">
                        <div class="progress-fill" style="width: 0%"></div>
                        <span class="student-text"></span>
                        <span class="foldout-arrow">
                            <i class="ph-fill ph-caret-up"></i>
                        </span>
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
            parts: [{
                name: "part1",
                questions: [{}]
            }]}, // minimal test data
            1,
            wsGetter,
            new EventTable(),
            new ActionButtons(),
            new NoteField(),
            new QuestionView()
        );

        const mainSocketHandler = socket.addEventListener.mock.calls.find(c => c[0] === "message")[1];
        mainSocketHandler({
            data: JSON.stringify({ event: 'student.joined', studentId: studentId })
        });

        p2pChannel = view.studentChannels[studentId];

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
                resultsByPart: {}
            },
        };

        p2pChannel.dispatchEvent(new CustomEvent('message', {
            detail: messageData 
        }));

        expect(spy).toHaveBeenCalledWith(messageData);
    });
});


describe("EventTable", () => {
    let table;

    beforeEach(() => {
        // Set up a standard DOM for the table
        document.body.innerHTML = `
            <table id="events">
                <tbody></tbody>
            </table>
        `;
        table = new EventTable();
    });

    it("updates the table with data when element exists", () => {
        table = new EventTable();
        const data = {
            event: "question.displayed",
            questionTitle: "What is 2+2?",
            displayedAt: "10:00:01"
        };

        table.updateTable(data);

        const rows = document.querySelectorAll("#events tbody tr");
        expect(rows.length).toBe(1);
        expect(rows[0].cells[0].textContent).toBe("question.displayed");
    });

    it("returns early and does not throw if eventsEl is null", () => {
        // 1. Setup: Clear the body so document.querySelector returns null
        document.body.innerHTML = "";

        table = new EventTable();

        // 2. Verify state: eventsEl should be null
        expect(table.eventsEl).toBeNull();

        const data = {
            event: "question.displayed",
            questionTitle: "Title",
            displayedAt: "10:00:00"
        };

        // 3. Act & Assert: This should not throw an error
        expect(() => {
            table.updateTable(data);
        }).not.toThrow();
    });


    it("renders an audio player when recordingBase64 is present", () => {
        const data = {
            event: 'question.answered',
            questionTitle: 'Oral Test',
            recordingBase64: 'data:audio/wav;base64,UklGR...',
            answeredAt: '12:00:00'
        };

        table.updateTable(data);

        const answerCell = document.querySelector('td:nth-child(3)');
        const audioEl = answerCell.querySelector('audio');

        expect(audioEl).not.toBeNull();
        expect(audioEl.src).toBe(data.recordingBase64);
        expect(audioEl.controls).toBe(true);
    });

    it("renders textAnswer when no audio is present", () => {
        const data = {
            event: 'question.answered',
            questionTitle: 'Written Test',
            textAnswer: 'This is my answer',
            answeredAt: '12:00:05'
        };

        table.updateTable(data);

        const answerCell = document.querySelector('td:nth-child(3)');
        expect(answerCell.textContent).toBe('This is my answer');
    });

    it("renders choiceId when neither audio nor textAnswer is present", () => {
        const data = {
            event: 'question.answered',
            questionTitle: 'Multiple Choice',
            choiceId: 'option_a',
            answeredAt: '12:00:10'
        };

        table.updateTable(data);

        const answerCell = document.querySelector('td:nth-child(3)');
        expect(answerCell.textContent).toBe('option_a');
    });

    it("uses answeredAt for the duration column when answered", () => {
        const data = {
            event: 'question.answered',
            questionTitle: 'Timing Test',
            answeredAt: 'TIMESTAMP_A',
            displayedAt: 'TIMESTAMP_B'
        };

        table.updateTable(data);

        const durationCell = document.querySelector('td:nth-child(4)');
        expect(durationCell.textContent).toBe('TIMESTAMP_A');
    });
});


describe("StudentCard", () => {
    let mockStudent;
    let mockTest;
    let template;

    beforeEach(() => {
        document.body.innerHTML = `
            <template id="student-card-template">
                <div class="student-card">
                    <div class="student-top-row">
                        <div class="progress-fill"></div>
                        <span class="student-text"></span>
                        <span class="foldout-arrow"><i class="ph-fill ph-caret-up"></i></span>
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
        `;

        mockStudent = new Student({
            id: 1,
            firstName: "John",
            lastName: "Doe"
        });
        
        mockStudent.progress = 45;
        mockStudent.currentPartIndex = 0;
        mockStudent.currentQuestionIndex = 1;
        mockStudent.resultsByPart = { 0: [true, false] };

        mockTest = {
            parts: [
                { name: "wordreading", questions: [{}, {}, {}] },
                { name: "wordspelling", questions: [{}, {}] }
            ]
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
        expect(segments[1].classList.contains("current")).toBe(true);
    });

    it("shows '-' for question index when viewing a part the student hasn't reached yet", () => {
        const card = new StudentCard(mockStudent, mockTest);
        
        card.changePart(1);
        
        expect(card.questionIndex.textContent).toContain("-/2");
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
            new QuestionView()
        );
    });

    afterEach(() => {
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
        vi.clearAllMocks();

        socket = {
            addEventListener: vi.fn(),
            send: vi.fn(),
        };
        wsGetter = vi.fn().mockReturnValue(socket);
        
        view = new TeacherView("room1", { parts: [] }, 1, wsGetter);
    });

    it("attaches the message listener to the WebSocket", () => {
        expect(socket.addEventListener).toHaveBeenCalledWith("message", expect.any(Function));
    });

    it("instantiates a new channel when a student offer arrives for the first time", () => {
        const socketHandler = socket.addEventListener.mock.calls.find(c => c[0] === "message")[1];

        socketHandler({
            data: JSON.stringify({ event: 'student.joined', studentId })
        });

        // Now WebRTCChannel is defined because of the import
        expect(WebRTCChannel).toHaveBeenCalledTimes(1);
        expect(view.studentChannels[studentId]).toBeDefined();
    });

    it("creates a new channel if a student re-joins", () => {
        const socketHandler = socket.addEventListener.mock.calls.find(c => c[0] === "message")[1];

        // First offer
        socketHandler({ data: JSON.stringify({ event: 'student.joined', studentId }) });
        const oldChannel = view.studentChannels[studentId]

        // Second offer for same student
        socketHandler({ data: JSON.stringify({ event: 'student.joined', studentId }) });
        
        expect(WebRTCChannel).toHaveBeenCalledTimes(2);
        expect(oldChannel.peer.destroy).toHaveBeenCalled();
    });

    it("ignores WebSocket messages that are not student.joined", () => {
        const socketHandler = socket.addEventListener.mock.calls.find(c => c[0] === "message")[1];

        socketHandler({
            data: JSON.stringify({ event: 'ping', studentId: 99 })
        });

        expect(WebRTCChannel).not.toHaveBeenCalled();
    });

    it("wires the P2P channel to the P2P message handler", () => {
        const p2pSpy = vi.spyOn(view, "_initP2PSocket");
        const socketHandler = socket.addEventListener.mock.calls.find(c => c[0] === "message")[1];

        socketHandler({ data: JSON.stringify({ event: 'student.joined', studentId }) });

        const newChannel = view.studentChannels[studentId];
        expect(p2pSpy).toHaveBeenCalledWith(newChannel);
    });

    it("calls p2p.connect() when the peer connection opens", () => {
        const socketHandler = socket.addEventListener.mock.calls.find(c => c[0] === "message")[1];
    
        socketHandler({
            data: JSON.stringify({ event: 'student.joined', studentId: 123 })
        });
    
        const p2p = view.studentChannels[123];
    
        const openHandler = p2p.peer.on.mock.calls.find(call => call[0] === 'open')[1];
    
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
        socket = { addEventListener: vi.fn(), send: vi.fn() };
        wsGetter = vi.fn().mockReturnValue(socket);
        
        // Ensure localStorage is clean before each test
        vi.spyOn(Storage.prototype, 'getItem');
    });

    afterEach(() => {
        vi.restoreAllMocks();
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
            { event: "question.displayed", id: 2 }
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
