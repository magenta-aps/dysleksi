/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi, assert } from "vitest";
import {EventTable, ActionButtons, TeacherView, NoteField, QuestionView} from "../../screening/controlroom.js";
import * as groupTestData from './grouptest.json' with { type: 'json' }
import * as individualTestData from './individualtest.json' with { type: 'json' }
import {Test} from "../../screening/model";
import { GroupTestContainer } from "../../screening/controlroom.js";

vi.mock("../../screening/utils.js");

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

describe("TeacherView", () => {
    let socket;
    let table;
    let buttons;
    let note;
    let questionView;
    let view;
    let wsGetter;
    let groupTest;
    let individualTest;

    beforeEach(() => {
        socket = {
            addEventListener: vi.fn(),
            send: vi.fn(),
        };
        wsGetter = vi.fn().mockReturnValue(socket);
        document.body.innerHTML = `
                <div id="question-container">
                <h1 id="question-title"></h1>
                <div id="question-content"></div>
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
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("sends null for 'correct' when the skip button is clicked", () => {
        vi.spyOn(global.crypto, "randomUUID").mockReturnValue("UUID-SKIP");

        view = new TeacherView("room1", individualTest, 1, wsGetter, table, buttons, note, questionView);
        view.setPartIndex(0);
        view.setQuestionIndex(0);

        // Click the skip button
        const skipButton = buttons.skipButton();
        skipButton.click();

        expect(socket.send).toHaveBeenCalledWith(JSON.stringify({
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
        }));
    });

    it("updates indices but does not enable buttons when event is 'question.answered'", () => {
        view = new TeacherView("room1", individualTest, 1, wsGetter, table, buttons, note, questionView);
    
        // 1. Setup: Ensure buttons are currently disabled
        buttons.disableButtons();
        const handler = socket.addEventListener.mock.calls.find(c => c[0] === "message")[1];
    
        // 2. Trigger 'question.answered'
        // This hits the outer IF but fails the 'question.displayed' IF
        handler({
            data: JSON.stringify({
                event: "question.answered",
                partIndex: 0,
                questionIndex: 0,
                practice: false,
                answeredAt: "10:00:05"
            }),
        });
    
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
        // Initialize view with individualTest data
        view = new TeacherView("room1", individualTest, 1, wsGetter, table, buttons, note, questionView);
    
        // Get the message handler from the mock socket
        const handler = socket.addEventListener.mock.calls.find(c => c[0] === "message")[1];
    
        // We set practice: true, but provide an index (e.g., 99) that 
        // exceeds the practice array length for part 0
        const invalidPracticeIndex = 99;
    
        expect(() => {
            handler({
                data: JSON.stringify({
                    event: "question.displayed",
                    partIndex: 0,
                    questionIndex: invalidPracticeIndex,
                    practice: true
                }),
            });
        }).toThrow(`Invalid question index ${invalidPracticeIndex}`);
    });

    it("sets the currentQuestion from the practice array when practice is true", () => {
        view = new TeacherView("room1", individualTest, 1, wsGetter, table, buttons, note, questionView);
    
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

    it("initializes socket and button listeners", () => {
        view = new TeacherView("room1", individualTest, 1, wsGetter, table, buttons, note, questionView);
        expect(wsGetter).toHaveBeenCalledWith("room1");
        expect(socket.addEventListener).toHaveBeenCalledWith(
            "message",
            expect.any(Function)
        );
    });

    it("enables buttons on question.displayed", () => {
        view = new TeacherView("room1", groupTest, 1, wsGetter, table, buttons, note, questionView);

        // get the message handler registered on the socket
        const handler = socket.addEventListener.mock.calls.find(c => c[0] === "message")[1];

        // trigger a question.displayed event
        handler({
            data: JSON.stringify({
                event: "question.displayed",
                partIndex: 0,
                questionIndex: 0,
                questionTitle: "Q1",
                displayedAt: 1000,
            }),
        });

        const btn = document.querySelector("button");
        expect(btn.classList.contains("disabled")).toBe(false);
    });

    it("disables 'next' button on 'question.displayed' (individual tests)", () => {
        view = new TeacherView("room1", individualTest, 1, wsGetter, table, buttons, note, questionView);

        // get the message handler registered on the socket
        const handler = socket.addEventListener.mock.calls.find(c => c[0] === "message")[1];

        // trigger first question.displayed event - question type is "free_text"
        handler({
            data: JSON.stringify({
                event: "question.displayed",
                partIndex: 0,
                questionIndex: 0,
                questionTitle: "Q1",
                displayedAt: 1000,
            }),
        });

        const btn = document.querySelector("button");
        expect(btn.classList.contains("disabled")).toBe(false);

        // trigger another question.displayed event - this time the question type is "no_input_required"
        handler({
            data: JSON.stringify({
                event: "question.displayed",
                partIndex: 0,
                questionIndex: 1,
                questionTitle: "Q2",
                displayedAt: 2000,
            }),
        });

        expect(buttons.nextButton().classList).to.include(["disabled"]);
    });

    it("show question on question.displayed", () => {
        view = new TeacherView("room1", individualTest, 1, wsGetter, table, buttons, note, questionView);

        questionView.show();
        expect(questionView.containerElement.classList.contains("d-none")).toBe(false)

        // get the message handler registered on the socket
        const handler = socket.addEventListener.mock.calls.find(c => c[0] === "message")[1];

        // trigger a question.displayed event
        handler({
            data: JSON.stringify({
                event: "question.displayed",
                partIndex: 0,
                questionIndex: 0,
            }),
        });

        expect(questionView.titleElement.textContent).toBe("1/3 (Individuel deltest)");

        handler({
            data: JSON.stringify({
                event: "question.displayed",
                partIndex: 0,
                questionIndex: 1,
            }),
        });

        expect(questionView.titleElement.textContent).toBe("2/3 (Individuel deltest)");
    });

    it("sends message and disables buttons on click", () => {
        vi.spyOn(global.crypto, "randomUUID").mockReturnValue("UUID123");

        view = new TeacherView("room1", individualTest, 1, wsGetter, table, buttons, note, questionView);
        // Add data in note field
        note.noteEl.value = "Test note";
        view.setPartIndex(0);
        view.setQuestionIndex(0);

        // click the button
        const wrongButton = buttons.wrongButton();
        wrongButton.click();

        expect(socket.send).toHaveBeenCalledWith(JSON.stringify({
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
        }));

        expect(wrongButton.classList.contains("disabled")).toBe(true);
    });

    it("delays sending feedback if question type is 'no_input_required'", () => {
        vi.spyOn(global.crypto, "randomUUID").mockReturnValue("UUID123");

        view = new TeacherView("room1", individualTest, 1, wsGetter, table, buttons, note, questionView);

        // Arrange: go directly to question 2 (which is type "no_input_required")
        view.setPartIndex(0);
        view.setQuestionIndex(1);

        // Act: fill note and click "correct"
        note.noteEl.value = "Test note";
        buttons.correctButton().click();

        // Assert: no socket message sent yet
        expect(socket.send).not.toHaveBeenCalled();

        // Act: click "next"
        buttons.nextButton().click();

        expect(socket.send).toHaveBeenCalledWith(JSON.stringify({
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
        }));
    });

    it("sends message and disables buttons on cancel click", () => {
        vi.spyOn(global.crypto, "randomUUID").mockReturnValue("UUID123");

        view = new TeacherView("room1", individualTest, 1, wsGetter, table, buttons, note, questionView);
        // Add data in note field
        note.noteEl.value = "Test note";
        view.setPartIndex(0);
        view.setQuestionIndex(0);

        // click the button
        const cancelButton = buttons.cancelButton();
        cancelButton.click();

        const expectedContent = JSON.stringify({
            uuid: "UUID123",
            event: "test.cancelled",
            roomName: "room1",
            partIndex: 0,
            questionIndex: 0,
            questionId: 1,
            partId: 1,
            assignmentId: 1,
            note: "Test note",
        });

        global.confirm = vi.fn().mockReturnValue(true);
        buttons.cancelButton().click();
        expect(socket.send).toHaveBeenCalledWith(expectedContent);
        expect(buttons.cancelButton().classList.contains("disabled")).toBe(true);
    });

    it("raise error when incorrect partindex is received", () => {
        view = new TeacherView("room1", individualTest, 1, wsGetter, table, buttons, note, questionView);

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
        view = new TeacherView("room1", individualTest, 1, wsGetter, table, buttons, note, questionView);
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
                    <div class="folded-area" style="display: none;"></div>
                </div>
            </template>

            <div class="group-test-body"></div>
        `;
        container = document.querySelector(".group-test-body");
        instance = new GroupTestContainer();
    });

    it("toggles folded area even when clicking on child elements (name text)", () => {
        const studentData = {
            student: { id: 5, firstName: "Eve", lastName: "Online", progress: 20 },
        };
        instance.updateData(studentData);
    
        const card = instance.cards.get(5)
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
            student: { id: 6, firstName: "Frank", lastName: "Castle", progress: 10 },
        };
        instance.updateData(studentData);
    
        const card = instance.cards.get(6)
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
            student: { id: 99, firstName: "Ghost", lastName: "User", progress: 0 },
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
            student: { id: 1, firstName: "Alice", lastName: "Smith", progress: 50 },
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
            student: { id: 1, firstName: "Alice", lastName: null, progress: 50 },
        };

        instance.updateData(studentData);

        const card = instance.cards.get(1)
        const text = card.el.querySelector(".student-text").textContent;
        expect(text).toBe("Alice");

    });


    it("updates an existing student card progress", () => {
        const studentData = {
            student: { id: 2, firstName: "Bob", lastName: "Jones", progress: 30 },
        };
        instance.updateData(studentData);

        const updatedData = {
            student: { id: 2, firstName: "Bob", lastName: "Jones", progress: 80 },
        };
        instance.updateData(updatedData);

        const card = instance.cards.get(2)
        const fill = card.el.querySelector(".progress-fill");
        expect(fill.style.width).toBe("80%");
    });

    it("adds correct/incorrect dots inside folded area", () => {
        const studentData = {
            student: { id: 3, firstName: "Charlie", lastName: "Brown", progress: 70 },
            correct: true
        };
        instance.updateData(studentData);


        const card = instance.cards.get(3)
        const folded = card.el.querySelector(".folded-area");
        const dot = folded.querySelector(".dot");
        expect(dot).not.toBeNull();
        expect(dot.style.backgroundColor).toBe("green");

        // Add an incorrect dot
        const studentData2 = {
            student: { id: 3, firstName: "Charlie", lastName: "Brown", progress: 70 },
            correct: false
        };
        instance.updateData(studentData2);
        const dots = folded.querySelectorAll(".dot");
        expect(dots.length).toBe(2);
        expect(dots[1].style.backgroundColor).toBe("red");
    });

    it("toggles folded area when card is clicked", () => {
        const studentData = {
            student: { id: 4, firstName: "Diana", lastName: "Prince", progress: 100 },
        };
        instance.updateData(studentData);
    
        const card = instance.cards.get(4)
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
                    <div class="folded-area" style="display: none;"></div>
                </div>
            </template>

            <div class="group-test-body"></div>
        `;

        socket = {
            addEventListener: vi.fn(),
            send: vi.fn(),
        };

        wsGetter = vi.fn().mockReturnValue(socket);

        view = new TeacherView(
            "room1",
            { parts: [] }, // minimal test data
            1,
            wsGetter,
            new EventTable(),
            new ActionButtons(),
            new NoteField(),
            new QuestionView()
        );
    });

    it("calls groupTestContainer.updateData when 'test.started' message is received", () => {
        const spy = vi.spyOn(view.groupTestContainer, "updateData");

        // get the message handler registered on the socket
        const handler = socket.addEventListener.mock.calls.find(c => c[0] === "message")[1];

        // simulate 'test.started' message
        const messageData = {
            event: "test.started",
            student: { id: 1, firstName: "Alice", lastName: "Smith", progress: 0 },
        };

        handler({ data: JSON.stringify(messageData) });

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