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
            <h1 id="student-header" class="student-header"></h1>
            <audio id="instructions-sound"></audio>
            <audio id="reminder-sound"></audio>
            <div id="summary-container"></div>
            <button id="end-summary"></button>
            <div id="question-challenge"></div>
            <div id="choices"></div>
            <button id="next"></button>
            <div id="test-summary"></div>
            <div id="testpart-intro"></div>
            <div id="test-intro"></div>
            <div id="test-container"></div>
            <button id="start-testpart"></button>
            <button id="start-summary"></button>
            <h2 id="testpart-intro-text"> </h2>
            <img src="/foo" alt="img" id="testpart-intro-image">
        `;

        global.domElements = new GroupTestDomElements();

        spyAttributes(global.domElements);

        global.testSpy = (test) => {
            // Apply spying to a test instance
            spyAttributes(test, ["chatSocket", "domElements", "summary"]);
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

    it("Render Summary when canPractice() = true", () => {
        const testData = JSON.parse(JSON.stringify(groupTestData));
        const test = new Test(testData);
        const view = new GroupTestView(test, ws, 'class_123', 1, domElements);
        testSpy(view);

        view.start();
        view.startSummary();
    
        expect(domElements.showSummary).toHaveBeenCalled();
        expect(domElements.setEndSummaryButtonListener).toHaveBeenCalledWith(
            expect.any(Function),
            "Start øveopgave"
        );

        domElements.endSummaryButton.click();
        expect(view.endSummary).toHaveBeenCalled();

    });
    
    it("Render Summary when canPractice() = false", () => {
        const testData = JSON.parse(JSON.stringify(groupTestData));

        // Ensure first part has no practice questions
        testData.parts[0].practice = [];

        const test = new Test(testData);
        const view = new GroupTestView(test, ws, 'class_123', 1, domElements);
        testSpy(view);
    
        view.start();
        view.startSummary();
    
        expect(domElements.showSummary).toHaveBeenCalled();
        expect(domElements.setEndSummaryButtonListener).toHaveBeenCalledWith(
            expect.any(Function),
            "Start deltest"
        );
    });


    it("Render intro and startSummary", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 'class_123', 1, domElements);
    
        const showIntroSpy = vi.spyOn(view, "showIntro");
        const startSummarySpy = vi.spyOn(view, "startSummary");
    
        view.start();
    
        expect(view.currentPart).toBe(test.parts[0]);
        expect(showIntroSpy).toHaveBeenCalled();
    
        // simulate user pressing the "start summary" button
        domElements.startSummaryButton.click();
    
        expect(startSummarySpy).toHaveBeenCalled();
    });

    it("Ends summary and displays practice question", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 'class_123', 1, domElements);
        testSpy(view);
        view.start();
        view.endSummary();

        const part = view.currentPart;

        expect(view.currentQuestionIndex).toBe(0);
        expect(view.isPracticing).toBe(true);
        expect(view.showFirstQuestion).toHaveBeenCalled();
    })

    it("Ends summary and displays first question", () => {

        const testData = JSON.parse(JSON.stringify(groupTestData));

        // Ensure first part has no practice questions
        testData.parts[0].practice = [];

        const test = new Test(testData);
        const view = new GroupTestView(test, ws, 'class_123', 1, domElements);
        testSpy(view);
        view.start();
        view.endSummary();

        const part = view.currentPart;

        expect(view.currentQuestionIndex).toBe(0);
        expect(view.isPracticing).toBe(false);
        expect(view.showFirstQuestion).toHaveBeenCalled();
    })

    it("Trigger for first question reminder", () => {
        vi.useFakeTimers();
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 'class_123', 1, domElements);
        test.parts[0].timeout = 0;
        test.parts[0].questions[0].reminder = 5000;
        // Mock audio play
        view.domElements.reminderSoundEl.play = vi.fn();
        testSpy(view);
        view.setPart(0)
        const part = view.currentPart;
        view.showFirstQuestion(false);
        const question = view.currentQuestion;
        const firstQuestionTitle = view.questionTitle();

        vi.runAllTimers();
        expect(view.domElements.reminderSoundEl.play).toHaveBeenCalled();
    });

    it("Let first question time out", () => {
        vi.useFakeTimers();
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 'class_123', 1, domElements);
        test.parts[0].timeout = 0;
        test.parts[0].questions[0].timeout = 10000;
        testSpy(view);
        view.setPart(0)
        
        const part = view.currentPart;
        view.showFirstQuestion(false);
        const question = view.currentQuestion;
        const firstQuestionTitle = view.questionTitle();

        vi.runAllTimers();

        expect(view.onQuestionComplete).toHaveBeenCalledWith(question, true);
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
            questionTitle: firstQuestionTitle,
            displayedAt: 0,
            answeredAt: expect.any(Number),
            duration: expect.any(Number),
            roomName: 'class_123',
            correct: false,
            textAnswer: null,
        });
    });

    it("Let first testpart time out on second question", () => {
        vi.useFakeTimers();
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 'class_123', 1, domElements);
        test.parts[0].timeout = 60000;
        testSpy(view);
        view.setPart(0)
        
        const part = view.currentPart;
        view.showFirstQuestion(false);
        const firstQuestion = view.currentQuestion;
        const firstQuestionTitle = view.questionTitle();

        view.showQuestion(false, 1);
        const remainingQuestions = part.questions.slice(view.currentQuestionIndex);

        vi.runAllTimers();
        
        remainingQuestions.forEach((question) => {
            expect(view.onQuestionComplete).toHaveBeenCalledWith(question, true);
            expect(view.send).toHaveBeenCalledWith({
                uuid: expect.any(String),
                event: "question.answered",
                message: `Elev besvarede ikke spørgsmål 1.${question.index+1} indenfor tidsfristen`,
                choiceId: null,
                recordingBase64: null,
                assignmentId: 1,
                partIndex: part.index,
                partId: part.id,
                questionIndex: question.index,
                questionId: question.id,
                questionTitle: `${question.index+1}/${part.questions.length} (${part.name})`,
                displayedAt: 0,
                answeredAt: expect.any(Number),
                duration: expect.any(Number),
                roomName: 'class_123',
                correct: false,
                textAnswer: null,
            });
        });
        expect(view.onQuestionComplete).not.toHaveBeenCalledWith(firstQuestion, true);
        expect(view.send).not.toHaveBeenCalledWith({
            uuid: expect.any(String),
            event: "question.answered",
            message: expect.any(String),
            choiceId: expect.toBeOneOf([null, expect.any(Number)]),
            recordingBase64: null,
            assignmentId: 1,
            partIndex: part.index,
            partId: part.id,
            questionIndex: firstQuestion.index,
            questionId: firstQuestion.id,
            questionTitle: firstQuestionTitle,
            displayedAt: expect.any(Number),
            answeredAt: expect.any(Number),
            duration: expect.any(Number),
            roomName: 'class_123',
            correct: expect.toBeOneOf([null, true, false]),
            textAnswer: null,
        });
    });

    it("Select second answer of first question", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 'class_123', 1, domElements);
        testSpy(view);
        view.setPart(0)
        
        const part = view.currentPart;
        view.showFirstQuestion(false);
        const question = view.currentQuestion;
        const secondAnswer = question.possibleAnswers[1]
        const answerButtonObj = view.answerButtons.find(a => a.answer === secondAnswer);
        answerButtonObj.button.click();

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
        view.setPart(0)
        
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
        view.setPart(0)
        
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
        view.setPart(0)
        
        const part = view.currentPart;
        view.showQuestion(true, 1);
        const question = view.currentQuestion;
        const correctAnswer = question.possibleAnswers.find(a => a.isCorrect);
        const answerButtonObj = view.answerButtons.find(a => a.answer === correctAnswer);
        answerButtonObj.button.click();
        view.onQuestionComplete(question);

        expect(view.showNextQuestion).toHaveBeenCalled();
        expect(view.domElements.makeButtonHappy).toHaveBeenCalled();
    });

    it("Answer practice question incorrectly", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 'class_123', 1, domElements);
        testSpy(view);
        view.setPart(0)
        
        const part = view.currentPart;
        view.showQuestion(true, 1);
        const question = view.currentQuestion;
        const incorrectAnswer = question.possibleAnswers.find(a => !a.isCorrect);
        const answerButtonObj = view.answerButtons.find(a => a.answer === incorrectAnswer);
        answerButtonObj.button.click();
        view.onQuestionComplete(question);

        expect(view.showNextQuestion).not.toHaveBeenCalled();
        expect(view.domElements.makeButtonAngry).toHaveBeenCalled();
    });

    it("Answer last practice question in part", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 'class_123', 1, domElements);
        testSpy(view);
        view.setPart(0)
        
        const part = view.currentPart;
        view.showQuestion(true, 2);
        const question = view.currentQuestion;
        const correctAnswer = question.possibleAnswers.find(a => a.isCorrect);
        view.selectAnswer(correctAnswer);
        view.onQuestionComplete(question);

        expect(view.showNextQuestion).toHaveBeenCalled();
        expect(view.domElements.makeButtonHappy).toHaveBeenCalled();
    });

    it("Answer last question in part", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 'class_123', 1, domElements);
        testSpy(view);
        view.setPart(0)
        const part = view.currentPart;
        view.showQuestion(false, part.questions.length - 1);
        const question = view.currentQuestion;
        const firstAnswer = question.possibleAnswers[0]
        view.selectAnswer(firstAnswer);
        view.onQuestionComplete(question);

        expect(view.onQuestionComplete).toHaveBeenCalled();
        expect(view.onPartComplete).toHaveBeenCalled();
        expect(view.showPart).toHaveBeenCalledWith(1);

        expect(view.showTestPartIntro).toHaveBeenCalled();

        domElements.startTestPartButton.click();
        expect(view.showFirstQuestion).toHaveBeenCalled();
    });

    it("Answer freetext question correctly", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 'class_123', 1, domElements);
        testSpy(view);
        view.setPart(1);
        
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
        view.setPart(1);
        
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
        view.setPart(test.parts.length - 1);
        const part = view.currentPart;
        view.showQuestion(false, part.questions.length - 1);
        const question = view.currentQuestion;
        const firstAnswer = question.possibleAnswers[0]
        view.input.textContent = firstAnswer.resourceText;
        view.selectFreeText();
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
        expect(domElements.setStudentHeader).toHaveBeenCalledWith('<i class="ph ph-ear"></i>');

    });

});


describe("GroupTestDomElements - showQuestionFreeText", () => {
    let domElements;
    let listenerMock;

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="choices"></div>
            <audio id="instructions-sound"></audio>
            <audio id="reminder-sound"></audio>
            <div id="instructions-text"></div>
            <button id="start-practice"></button>
            <button id="start-questions"></button>
            <button id="end-summary"></button>
            <div id="question-title"></div>
            <div id="question-challenge"></div>
            <button id="next"></button>
            <div id="test-summary"></div>
            <div id="testpart-intro"></div>
            <div id="test-intro"></div>
            <div id="test-container"></div>
        `;

        domElements = new GroupTestDomElements();
        listenerMock = vi.fn();
    });

    it("renders free text input with letters and erase button", () => {
        const displayField = domElements.showQuestionFreeText(listenerMock);

        // Display field exists
        expect(displayField).toBeInstanceOf(HTMLElement);
        expect(displayField.classList.contains("display-field")).toBe(true);

        // Letter buttons exist
        const letterButtons = document.querySelectorAll(".letter-btn");
        letterButtons.forEach(b => b.disabled = false);
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
        const displayField = domElements.showQuestionFreeText(listenerMock);
        const letterButtons = document.querySelectorAll(".letter-btn");
        const eraseBtn = document.querySelector(".erase-btn");

        // Type "abc"
        letterButtons.forEach(b => b.disabled = false);
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
        const displayField = domElements.showQuestionFreeText(() => {});
        expect(displayField).toBeInstanceOf(HTMLElement);
        expect(displayField.classList.contains("display-field")).toBe(true);
    });
});


describe("GroupTestDomElements - showQuestionChallenge", () => {
    let domElements;

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="choices"></div>
            <audio id="instructions-sound"></audio>
            <audio id="reminder-sound"></audio>
            <div id="instructions-text"></div>
            <button id="start-practice"></button>
            <button id="start-questions"></button>
            <button id="end-summary"></button>
            <div id="question-title"></div>
            <div id="question-challenge"></div>
            <button id="next"></button>
        `;
        domElements = new GroupTestDomElements();
    });

    it("displays a question with sound correctly", () => {
        const soundUrl = "https://example.com/audio.mp3";
        const questionText = "Listen carefully";

        domElements.showQuestionChallenge(null, soundUrl);

        // Audio element should exist
        const audioEl = document.getElementById("challenge-audio");
        expect(audioEl).toBeInstanceOf(HTMLAudioElement);
        expect(audioEl.src).toBe(soundUrl);

        // Play button exists
        const playBtn = document.getElementById("challenge-sound-btn");
        expect(playBtn).toBeInstanceOf(HTMLButtonElement);
        expect(playBtn.classList.contains("pulse")).toBe(true);

        // Mock audio play
        audioEl.play = vi.fn();

        // Click play button
        playBtn.click();

        // Audio should be played and pulse removed
        expect(audioEl.play).toHaveBeenCalled();
        expect(playBtn.classList.contains("pulse")).toBe(false);
    });

    it("removes audio and play button if sound is removed", () => {
        const soundUrl = "https://example.com/audio.mp3";
        domElements.showQuestionChallenge(null, soundUrl);

        // Now call again with no sound
        domElements.showQuestionChallenge("Test", null);

        const audioEl = document.getElementById("challenge-audio");
        const playBtn = document.getElementById("challenge-sound-btn");

        expect(audioEl).toBeNull();
        expect(playBtn).toBeNull();
    });

    it("replaces audio when a new audio URL is given", () => {
        const firstSound = "https://example.com/audio.mp3";
        const secondSound = "https://example.com/audio2.mp3";

        domElements.showQuestionChallenge(null, firstSound, null);
        let audioEl = document.getElementById("challenge-audio");
        expect(audioEl.src).toBe(firstSound);

        domElements.showQuestionChallenge(null, secondSound, null);
        audioEl = document.getElementById("challenge-audio");
        expect(audioEl.src).toBe(secondSound);
    });


    it("displays a question with an image correctly", () => {
        const imageUrl = "https://example.com/image.png";

        domElements.showQuestionChallenge(null, null, imageUrl);

        const challengeEl = document.getElementById("question-challenge");

        // Image element should exist
        const imgEl = document.querySelector("#challenge-image");
        expect(imgEl).toBeInstanceOf(HTMLImageElement);
        expect(imgEl.src).toBe(imageUrl);

        // Image element should be removed when called with text
        domElements.showQuestionChallenge("foo", null, null);
        const removedImg = document.querySelector("#challenge-image");
        expect(removedImg).toBeNull();
    });

    it("replaces image when a new image URL is given", () => {
        const firstImage = "https://example.com/first.png";
        const secondImage = "https://example.com/second.png";

        domElements.showQuestionChallenge(null, null, firstImage);
        let imgEl = document.querySelector("#challenge-image");
        expect(imgEl.src).toBe(firstImage);

        domElements.showQuestionChallenge(null, null, secondImage);
        imgEl = document.querySelector("#challenge-image");
        expect(imgEl.src).toBe(secondImage);
    });

    it("enables all letter buttons when audio is played", () => {
        // First, create some disabled letter buttons
        const letterBtn1 = document.createElement("button");
        letterBtn1.className = "letter-btn";
        letterBtn1.disabled = true;
        const letterBtn2 = document.createElement("button");
        letterBtn2.className = "letter-btn";
        letterBtn2.disabled = true;
        document.body.append(letterBtn1, letterBtn2);
    
        // Set up audio challenge
        const soundUrl = "https://example.com/audio.mp3";
        domElements.showQuestionChallenge(null, soundUrl);
    
        const audioEl = document.getElementById("challenge-audio");
        const playBtn = document.getElementById("challenge-sound-btn");
    
        audioEl.play = vi.fn();
    
        // Before clicking, buttons are disabled
        expect(letterBtn1.disabled).toBe(true);
        expect(letterBtn2.disabled).toBe(true);
    
        // Click play
        playBtn.click();
    
        // Audio played
        expect(audioEl.play).toHaveBeenCalled();
    
        // Buttons are still disabled before audio ends
        expect(letterBtn1.disabled).toBe(true);
        expect(letterBtn2.disabled).toBe(true);
    
        // Manually trigger audio.onended
        audioEl.onended();
    
        // Buttons should now be enabled
        expect(letterBtn1.disabled).toBe(false);
        expect(letterBtn2.disabled).toBe(false);
    
        // Play button classes updated correctly
        expect(playBtn.classList.contains("playing")).toBe(false);
    });


});
