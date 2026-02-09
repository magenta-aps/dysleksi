/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as groupTestData from './grouptest.json' with { type: 'json' }
import { getWebSocket } from "../../ws";
import { GroupTestDomElements } from "../../screening/dom.js";
import { Test } from "../../screening/model.js";
import { GroupTestView } from "../../screening/group/student-group-test.js";

describe('GroupTestFlow', () => {
    let originalWebSocket;
    let mockSend;

    beforeEach(() => {
        // Mock window.location correctly
        global.window = {
            location: { protocol: 'https:', host: 'example.com' }
        };
        global.document.timeline = {
                currentTime: 0,
        }
        global.alert = vi.fn();

        // Save original WebSocket
        originalWebSocket = global.WebSocket;

        // Mock WebSocket as a class (constructor)
        mockSend = vi.fn();
        global.WebSocket = class {
            constructor(url) {
                this.url = url;
                this.send = mockSend;
                this.close = vi.fn();
                this.addEventListener = vi.fn();
            }
        };

        const visited = new Set();
        const spyAttributes = function(targetItem, omitkeys=[]) {
            // Avoid infinite recursion caused by circular references
            if (visited.has(targetItem)) return;
            visited.add(targetItem);

            // Get all properties of the object and its prototype chain
            const props = [];
            if (!omitkeys.includes("__proto__")) {
                omitkeys.push("__proto__");
            }
            let obj = targetItem;
            do {
                props.push(...Object.getOwnPropertyNames(obj));
            } while (obj = Object.getPrototypeOf(obj));

            // Spy on all functions and list items
            for (let attributeName of props) {
                if (omitkeys.includes(attributeName)) continue;
                let attribute = targetItem[attributeName];
                if (typeof(attribute) === "function") {
                    vi.spyOn(targetItem, attributeName);
                } else if (typeof(attribute) === "object" && attribute !== undefined && attribute !== null) {
                    if (Array.isArray(attribute)) {
                        for (let i = 0; i < attribute.length; i++) {
                            spyAttributes(attribute[i], omitkeys);
                        }
                    } else {
                        // spyAttributes(attribute, omitkeys);
                    }
                }
            }
        };

        document.body.innerHTML = `
            <div id="fade-overlay"></div>
            <audio id="instructions-sound"></audio>
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

        global.domElements = new GroupTestDomElements();
        spyAttributes(global.domElements);

        global.testSpy = (test) => {
            // Apply spying to a test instance
            spyAttributes(test, ["chatSocket", "domElements", "summary", "summaryText"]);
        }

        global.ws = getWebSocket('class_123');
    });

    afterEach(() => {
        // Restore WebSocket
        global.WebSocket = originalWebSocket;
    });

    it('Test Structure loads', () => {
        // Test that the instance with subinstances is correctly created from json
        const test = new Test(groupTestData);
        expect(test.name).toBe("Middle 2. grade");
        expect(test.parts.length).toBe(2);
        expect(test.parts[0].test).toBe(test);
        expect(test.parts[0].id).toBe(5);
        expect(test.parts[0].index).toBe(0);
        expect(test.parts[0].name).toBe('Wordreading 2A (dummy)');
        expect(test.parts[0].instructionsUrl).toBe(null);
        expect(test.parts[0].intro).toBe('Vælg det rigtige ord, der passer til billedet.');
        expect(test.parts[0].timeout).toBe(60);
        expect(test.parts[0].partialScoreAfter).toBe(30);
        expect(test.parts[0].questions.length).toBe(5);
        expect(test.parts[0].questionIndex).toBe(0);
        expect(test.parts[0].currentQuestion).toBe(null);
        expect(test.parts[0].practice.length).toBe(3);
    });

    it("Test complain when there are no parts", () => {
        const ws = getWebSocket('class_123');
        expect(
            () => new Test(
                {
                    "id": 1,
                    "name": "Middle 2. grade",
                    "parts": []
                },
                ws,
                'class_123',
                domElements
            )
        ).toThrowError("Test has no parts");
    });

    it("Render Summary", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 'class_123', 1, domElements);
        testSpy(view);
        view.start();

        expect(view.currentPart).toBe(null);
        expect(view.showPart).not.toHaveBeenCalled();
        expect(domElements.showSummary).toHaveBeenCalled();
        expect(domElements.toggleSummaryTable).toHaveBeenCalledWith(true);
        expect(domElements.togglePracticeButton).toHaveBeenCalledWith(false);
        expect(domElements.toggleQuestionsButton).toHaveBeenCalledWith(false);
    })

    it("Render first part", () => {
        // Should show the first part with options to begin practicing or start the real test
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 'class_123', 1, domElements);
        testSpy(view);
        view.endSummary();

        expect(view.currentPart).toBe(test.parts[0]);
        expect(view.showPart).toHaveBeenCalledWith(0);
        expect(domElements.hideSummary).toHaveBeenCalled();
        expect(domElements.clearQuestionChoices).toHaveBeenCalled();
        expect(domElements.toggleNextButton).toHaveBeenCalledWith(false)
        expect(domElements.togglePracticeButton).toHaveBeenCalledWith(true)
        expect(domElements.toggleQuestionsButton).toHaveBeenCalledWith(true)
    })

    it("Render second part", () => {
        // Should show the second part with option start the real test (As no practice is defined for the second part)
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 'class_123', 1, domElements);
        testSpy(view);
        view.showPart(1);

        expect(view.currentPart).toBe(test.parts[1]);
        expect(domElements.clearQuestionChoices).toHaveBeenCalled();
        expect(domElements.toggleNextButton).toHaveBeenCalledWith(false)
        expect(domElements.togglePracticeButton).toHaveBeenCalledWith(false)
        expect(domElements.toggleQuestionsButton).toHaveBeenCalledWith(true)
    })

    it("Display first question", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 'class_123', 1, domElements);
        testSpy(view);
        view.start();

        view.endSummary();
        const part = view.currentPart;
        view.showFirstQuestion(false);

        expect(view.currentQuestionIndex).toBe(0);
        expect(view.isPracticing).toBe(false);
        expect(view.currentQuestion).toBe(part.questions[0]);
        const question = view.currentQuestion;
        expect(view.showQuestion).toHaveBeenCalled();
        expect(domElements.showQuestionChallenge).toHaveBeenCalled();
        expect(domElements.toggleNextButton).toHaveBeenLastCalledWith(false);
        for (let answer of question.possibleAnswers) {
            expect(domElements.showQuestionChoice).toHaveBeenCalledWith(
                answer.resourceText,
                answer.resourceSoundUrl,
                answer.resourceImageUrl,
                expect.any(Function)
            );
        }
        expect(view.send).toHaveBeenCalledWith({
            uuid: expect.any(String),
            event: "question.displayed",
            assignmentId: 1,
            partIndex: part.index,
            partId: part.id,
            questionIndex: question.index,
            questionId: question.id,
            questionTitle: "1/5 (Wordreading 2A (dummy))",
            displayedAt: 0,
            roomName: view.roomName,
        })
    });

    it("Let first question time out", () => {
        vi.useFakeTimers();
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 'class_123', 1, domElements);
        test.parts[0].questions[0].timeout = 10000
        testSpy(view);
        view.endSummary();
        const part = view.currentPart;
        view.showFirstQuestion(false);
        const question = view.currentQuestion;

        // TODO: Get correct runAllTimers-function for whatever test framework we're using
        vi.runAllTimers();

        expect(view.onTimeout).toHaveBeenCalled();
        expect(view.send).toHaveBeenCalledWith({
            uuid: expect.any(String),
            event: "question.answered",
            message: `Elev besvarede ikke spørgsmål 1.1 indenfor tidsfristen`,
            choiceId: null,
            recordingBase64: null,
            assignmentId: 1,
            partIndex: part.index,
            partId: part.id,
            questionIndex: question.index,
            questionId: question.id,
            questionTitle: view.questionTitle(),
            displayedAt: 0,
            answeredAt: expect.any(Number),
            duration: 10000,
            roomName: 'class_123',
            correct: false,
            textAnswer: null,
        });
        expect(view.onQuestionComplete).toHaveBeenCalled();
    });

    it("Select second answer of first question", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 'class_123', 1, domElements);
        testSpy(view);
        view.endSummary();
        const part = view.currentPart;
        view.showFirstQuestion(false);
        const question = view.currentQuestion;
        const secondAnswer = question.possibleAnswers[1]
        view.selectAnswer(secondAnswer);

        expect(view.selectedAnswer, secondAnswer)
        expect(domElements.toggleNextButton).toHaveBeenLastCalledWith(true);
        for (let d of view.answerButtons) {
            expect(domElements.toggleButtonSelected).toHaveBeenCalledWith(
                d["button"], d["answer"] === secondAnswer
            );
        }
    });

    it("Go to next question", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 'class_123', 1, domElements);
        testSpy(view);
        view.endSummary();
        const part = view.currentPart;
        view.showFirstQuestion(false);
        const question = view.currentQuestion;
        const secondAnswer = question.possibleAnswers[1]
        view.selectAnswer(secondAnswer);
        view.onQuestionComplete(question);

        expect(view.send).toHaveBeenCalledWith({
            uuid: expect.any(String),
            event: "question.answered",
            message: `Elev har gennemført spørgsmål 1.1`,
            choiceId: secondAnswer.id,
            recordingBase64: null,
            assignmentId: 1,
            partIndex: part.index,
            partId: part.id,
            questionIndex: question.index,
            questionId: question.id,
            questionTitle: "1/5 (Wordreading 2A (dummy))",
            displayedAt: 0,
            answeredAt: 0,
            duration: 0,
            roomName: view.roomName,
            correct: false,
            textAnswer: null,
        });
        expect(view.onQuestionComplete).toHaveBeenCalled();
        expect(view.showNextQuestion).toHaveBeenCalled();
        expect(view.showQuestion).toHaveBeenCalledWith(false, 1);
    });

    it("Answer practice question without selecting answer", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 'class_123', 1, domElements);
        testSpy(view);
        view.endSummary();
        const part = view.currentPart;
        view.showQuestion(true, 1);
        const question = view.currentQuestion;
        view.onQuestionComplete(question);
        expect(view.showNextQuestion).not.toHaveBeenCalled();
        expect(global.alert).toHaveBeenCalledWith("Vælg et svar, før du går videre.");
    });

    it("Answer practice question correctly", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 'class_123', 1, domElements);
        testSpy(view);
        view.endSummary();
        const part = view.currentPart;
        view.showQuestion(true, 1);
        const question = view.currentQuestion;
        const correctAnswer = question.possibleAnswers.find(a => a.isCorrect);
        view.selectAnswer(correctAnswer);
        view.onQuestionComplete(question);

        expect(view.showNextQuestion).toHaveBeenCalled();
        expect(global.alert).toHaveBeenCalledWith("Ja, det er rigtigt. Prøv næste øveopgave.");
    });

    it("Answer practice question incorrectly", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 'class_123', 1, domElements);
        testSpy(view);
        view.endSummary();
        const part = view.currentPart;
        view.showQuestion(true, 1);
        const question = view.currentQuestion;
        const incorrectAnswer = question.possibleAnswers.find(a => !a.isCorrect);
        view.selectAnswer(incorrectAnswer);
        view.onQuestionComplete(question);

        expect(view.showNextQuestion).not.toHaveBeenCalled();
        expect(global.alert).toHaveBeenCalledWith("Nej, det er forkert. Prøv at vælge igen.");
    });

    it("Answer last practice question in part", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 'class_123', 1, domElements);
        testSpy(view);
        view.endSummary();
        const part = view.currentPart;
        view.showQuestion(true, 2);
        const question = view.currentQuestion;
        const correctAnswer = question.possibleAnswers.find(a => a.isCorrect);
        view.selectAnswer(correctAnswer);
        view.onQuestionComplete(question);

        expect(view.showNextQuestion).toHaveBeenCalled();
        expect(global.alert).toHaveBeenCalledWith("Øveopgaver gennemført. Begynd den rigtige test");
    });

    it("Answer last question in part", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 'class_123', 1, domElements);
        testSpy(view);
        view.endSummary();
        const part = view.currentPart;
        view.showQuestion(false, part.questions.length - 1);
        const question = view.currentQuestion;
        const firstAnswer = question.possibleAnswers[0]
        view.selectAnswer(firstAnswer);
        view.onQuestionComplete(question);

        expect(view.onQuestionComplete).toHaveBeenCalled();
        expect(view.onPartComplete).toHaveBeenCalled();
        expect(view.showPart).toHaveBeenCalledWith(1);
    });

    it("Answer freetext question correctly", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 'class_123', 1, domElements);
        testSpy(view);
        view.endSummary();
        view.showPart(1);
        const part = view.currentPart;
        view.showQuestion(false, 0);
        expect(view.input).not.toBe(null);
        const question = view.currentQuestion;
        view.input.textContent = "aput";
        view.selectFreeText();
        view.onQuestionComplete(question);
        expect(view.send).toHaveBeenCalledWith({
            "answeredAt": 0,
            "assignmentId": 1,
            "choiceId": 100,
            "correct": true,
            "displayedAt": 0,
            "duration": 0,
            "event": "question.answered",
            "message": "Elev har gennemført spørgsmål 2.1",
            "partId": 6,
            "partIndex": 1,
            "questionId": 25,
            "questionIndex": 0,
            "questionTitle": "1/2 (Wordspelling 2B (dummy))",
            "recordingBase64": null,
            "roomName": "class_123",
            "textAnswer": "aput",
            "uuid": expect.any(String),
        });
    });

    it("Answer freetext question incorrectly", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 'class_123', 1, domElements);
        testSpy(view);
        view.endSummary();
        view.showPart(1);
        view.showQuestion(false, 0);
        expect(view.input).not.toBe(null);
        const question = view.currentQuestion;
        view.input.textContent = "forkert";
        view.selectFreeText();
        view.onQuestionComplete(question);
        expect(view.send).toHaveBeenCalledWith({
            "answeredAt": 0,
            "assignmentId": 1,
            "choiceId": 100,
            "correct": false,
            "displayedAt": 0,
            "duration": 0,
            "event": "question.answered",
            "message": "Elev har gennemført spørgsmål 2.1",
            "partId": 6,
            "partIndex": 1,
            "questionId": 25,
            "questionIndex": 0,
            "questionTitle": "1/2 (Wordspelling 2B (dummy))",
            "recordingBase64": null,
            "roomName": "class_123",
            "textAnswer": "forkert",
            "uuid": expect.any(String),
        });
    });

    it("Answer last question in last part", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 'class_123', 1, domElements);
        testSpy(view);
        const canShow = view.showPart(test.parts.length - 1);
        expect(canShow).toBe(true);
        const part = view.currentPart;
        view.showQuestion(false, part.questions.length - 1);
        const question = view.currentQuestion;
        const firstAnswer = question.possibleAnswers[0]
        view.selectAnswer(firstAnswer);
        view.onQuestionComplete(question);

        expect(view.onQuestionComplete).toHaveBeenCalled();
        expect(view.onPartComplete).toHaveBeenCalled();
        expect(domElements.hideInstructions).toHaveBeenCalled();
        expect(view.send).toHaveBeenCalledWith({
            uuid: expect.any(String),
            event: "test.complete",
            assignmentId: 1,
            message: "Testen er afsluttet",
            roomName: view.roomName,
        });
    });

    it("Show instructions", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 'class_123', 1, domElements);
        testSpy(view);
        view.showPart(0);
        view.showQuestion(true, 0);
        expect(domElements.showQuestionTitle).toHaveBeenCalledWith("Instruks");
    });

});


describe("GroupTestDomElements - showQuestionFreeText", () => {
    let domElements;
    let listenerMock;

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="choices"></div>
            <audio id="instructions-sound"></audio>
            <div id="instructions-text"></div>
            <button id="start-practice"></button>
            <button id="start-questions"></button>
            <table id="summary-table"></table>
            <button id="end-summary"></button>
            <div id="question-title"></div>
            <div id="question-challenge"></div>
            <button id="next"></button>
        `;

        domElements = new GroupTestDomElements();
        listenerMock = vi.fn();
    });

    it("renders free text input with letters and erase button", () => {
        const displayField = domElements.showQuestionFreeText("Type here", null, null, listenerMock);

        // Display field exists
        expect(displayField).toBeInstanceOf(HTMLElement);
        expect(displayField.classList.contains("display-field")).toBe(true);

        // Letter buttons exist
        const letterButtons = document.querySelectorAll(".letter-btn");
        expect(letterButtons.length).toBe(18); // 3 rows * 6 letters

        // Erase button exists
        const eraseBtn = document.querySelector(".erase-btn");
        expect(eraseBtn).toBeInstanceOf(HTMLElement);
        expect(eraseBtn.disabled).toBe(true); // initially disabled

        // Click a letter button
        letterButtons[0].click(); // should append "a" to display
        expect(displayField.textContent).toBe("a");
        expect(listenerMock).toHaveBeenCalledWith({ target: { value: "a" } });
        expect(eraseBtn.disabled).toBe(false);

        // Click erase button
        eraseBtn.click();
        expect(displayField.textContent).toBe("");
        expect(listenerMock).toHaveBeenCalledWith({ target: { value: "" } });
        expect(eraseBtn.disabled).toBe(true);
    });

    it("supports multiple letters and listener calls", () => {
        const displayField = domElements.showQuestionFreeText("", null, null, listenerMock);
        const letterButtons = document.querySelectorAll(".letter-btn");
        const eraseBtn = document.querySelector(".erase-btn");

        // Type "abc"
        letterButtons[0].click();
        letterButtons[1].click();
        letterButtons[2].click();
        expect(displayField.textContent).toBe("aef"); // first row letters: a, e, f, g, i, j
        expect(listenerMock).toHaveBeenCalledTimes(3);

        // Erase last letter
        eraseBtn.click();
        expect(displayField.textContent).toBe("ae");
    });

    it("returns the display field element", () => {
        const displayField = domElements.showQuestionFreeText();
        expect(displayField).toBeInstanceOf(HTMLElement);
        expect(displayField.classList.contains("display-field")).toBe(true);
    });
});
