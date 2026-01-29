/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GroupTest } from '../../screening/test.js';
import * as groupTestData from './grouptest.json' with { type: 'json' }
import {getWebSocket} from "../../ws";
import {GroupTestDomElements} from "../../screening/dom.js";

describe('getWebSocket', () => {
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
            <audio id="instructions-sound"></audio>
            <div id="instructions-text"></div>
            <button id="start-practice"></button>
            <button id="start-questions"></button>
            <div id="question-title"></div>
            <div id="question-challenge"></div>
            <div id="choices"></div>
            <button id="next"></button>
        `;

        global.domElements = new GroupTestDomElements();
        spyAttributes(global.domElements);

        global.testSpy = (test) => {
            // Apply spying to a test instance
            spyAttributes(test, ["chatSocket", "domElements"]);
        }

        global.ws = getWebSocket('class_123');
    });

    afterEach(() => {
        // Restore WebSocket
        global.WebSocket = originalWebSocket;
    });

    it('Test Structure loads', () => {
        // Test that the instance with subinstances is correctly created from json
        const ws = getWebSocket('class_123');
        const test = new GroupTest(groupTestData, ws, 'class_123', domElements);
        expect(test.roomName).toBe("class_123");
        expect(test.name).toBe("Middle 2. grade");
        expect(test.partIndex).toBe(0);
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
        expect(test.parts[0].domElements).toBe(domElements);
        expect(test.parts[0].practice.length).toBe(2);
        expect(test.parts[0].isPracticing).toBe(false);
    });

    it("Test complain when there are no parts", () => {
        const ws = getWebSocket('class_123');
        expect(
            () => new GroupTest(
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

    it("Render first part", () => {
        // Should show the first part with options to begin practicing or start the real test
        const test = new GroupTest(groupTestData, ws, 'class_123', domElements);
        testSpy(test);
        test.start();

        expect(test.currentPart).toBe(test.parts[0]);
        expect(test.parts[0].start).toHaveBeenCalled();
        expect(domElements.clearQuestionChoices).toHaveBeenCalled();
        expect(domElements.toggleNextButton).toHaveBeenCalledWith(false)
        expect(domElements.togglePracticeButton).toHaveBeenCalledWith(true)
        expect(domElements.toggleQuestionsButton).toHaveBeenCalledWith(true)
    })

    it("Render second part", () => {
        // Should show the second part with option start the real test (As no practice is defined for the second part)
        const test = new GroupTest(groupTestData, ws, 'class_123', domElements);
        testSpy(test);
        test.showPart(1);

        expect(test.currentPart).toBe(test.parts[1]);
        expect(test.parts[1].start).toHaveBeenCalled();
        expect(domElements.clearQuestionChoices).toHaveBeenCalled();
        expect(domElements.toggleNextButton).toHaveBeenCalledWith(false)
        expect(domElements.togglePracticeButton).toHaveBeenCalledWith(false)
        expect(domElements.toggleQuestionsButton).toHaveBeenCalledWith(true)
    })

    it("Display first question", () => {
        const test = new GroupTest(groupTestData, ws, 'class_123', domElements);
        testSpy(test);
        test.start();
        const part = test.currentPart;
        part.showFirstQuestion(false);

        expect(part.questionIndex).toBe(0);
        expect(part.isPracticing).toBe(false);
        expect(part.currentQuestion).toBe(part.questions[0]);
        const question = part.currentQuestion;
        expect(question.show).toHaveBeenCalled();
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
        expect(test.send).toHaveBeenCalledWith({
            event: "test.displayed",
            part: part.index,
            question: question.index,
            displayedAt: 0,
            id: test.roomName,
        })
    });

    it("Select second answer of first question", () => {
        const test = new GroupTest(groupTestData, ws, 'class_123', domElements);
        testSpy(test);
        test.start();
        const part = test.currentPart;
        part.showFirstQuestion(false);
        const question = part.currentQuestion;
        const secondAnswer = question.possibleAnswers[1]
        secondAnswer.select();

        expect(question.selectedChoice, secondAnswer)
        expect(domElements.toggleNextButton).toHaveBeenLastCalledWith(true);
        for (let answer of question.possibleAnswers) {
            expect(domElements.toggleButtonSelected).toHaveBeenCalledWith(answer.button, answer === secondAnswer);
        }
    });

    it("Go to next question", () => {
        const test = new GroupTest(groupTestData, ws, 'class_123', domElements);
        testSpy(test);
        test.start();
        const part = test.currentPart;
        part.showFirstQuestion(false);
        const question = part.currentQuestion;
        const secondAnswer = question.possibleAnswers[1]
        secondAnswer.select();
        question.onComplete();

        expect(test.send).toHaveBeenCalledWith({
            event: "test.answered",
            message: `Elev har gennemført spørgsmål 1`,
            choice: secondAnswer.id,
            recordingBase64: null,
            part: part.index,
            question: question.index,
            displayedAt: 0,
            answeredAt: 0,
            duration: "0.0",
            id: test.roomName,
            correct: false,
            textAnswer: null,
        });
        expect(part.onQuestionComplete).toHaveBeenCalled();
        expect(part.showNextQuestion).toHaveBeenCalled();
        expect(part.showQuestion).toHaveBeenCalledWith(false, 1);
        expect(part.questions[1].show).toHaveBeenCalled();
    });

    it("Answer freetext question", () => {
        const test = new GroupTest(groupTestData, ws, 'class_123', domElements);
        testSpy(test);
        domElements.showQuestionFreeText = vi.fn(() => {
            return {
                textContent: {
                    trim: () => "dummy_answer"
                }
            }
        })
        test.showPart(1);
        const part = test.currentPart;
        part.showQuestion(false, part.questions.length - 1);
        const question = part.currentQuestion;

        expect(domElements.showQuestionFreeText).toHaveBeenCalled();

        const answer = question.possibleAnswers[0];
        answer.selectFreeText();

        expect(answer.textAnswer).toBe("dummy_answer");
        expect(answer.isCorrect).toBe(false);
    })

    it("Answer last question in part", () => {
        const test = new GroupTest(groupTestData, ws, 'class_123', domElements);
        testSpy(test);
        test.start();
        const part = test.currentPart;
        part.showQuestion(false, part.questions.length - 1);
        const question = part.currentQuestion;
        const firstAnswer = question.possibleAnswers[0]
        firstAnswer.select();
        question.onComplete();

        expect(part.onQuestionComplete).toHaveBeenCalled();
        expect(part.onComplete).toHaveBeenCalled();
        expect(test.onPartComplete).toHaveBeenCalled();
        expect(test.showPart).toHaveBeenCalledWith(1);
    });

    it("Answer last question in last part", () => {
        const test = new GroupTest(groupTestData, ws, 'class_123', domElements);
        testSpy(test);
        test.showPart(test.parts.length - 1);
        const part = test.currentPart;
        part.showQuestion(false, part.questions.length - 1);
        const question = part.currentQuestion;
        const firstAnswer = question.possibleAnswers[0]
        firstAnswer.select();
        question.onComplete();

        expect(part.onQuestionComplete).toHaveBeenCalled();
        expect(part.onComplete).toHaveBeenCalled();
        expect(test.onPartComplete).toHaveBeenCalled();
        expect(test.onComplete).toHaveBeenCalled();
        expect(domElements.hideInstructions).toHaveBeenCalled();
        expect(test.send).toHaveBeenCalledWith({
            event: "test.completed",
            message: "Testen er afsluttet",
            id: test.roomName,
        });
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
