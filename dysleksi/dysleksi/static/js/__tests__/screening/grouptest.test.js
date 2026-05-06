/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as groupTestData from "./grouptest.json" with { type: "json" };
import * as letterSoundTestData from "./letter_sound_test.json" with { type: "json" };
import * as letterNameTestData from "./letter_name_test.json" with { type: "json" };
import * as sentenceReadingTestData from "./sentence_reading_test.json" with { type: "json" };
import * as letterShapeTestData from "./letter_shape_test.json" with { type: "json" };
import { getWebSocket } from "../../ws";
import { GroupTestDomElements } from "../../screening/dom.js";
import { Test } from "../../screening/model.js";
import { GroupTestView } from "../../screening/group/student-group-test.js";
import { spyAttributes } from "../utils.js";
import * as utils from "../../screening/utils.js";
import { Student } from "../../screening/model.js"; // wherever your Student class is defined
import { InstructionSequenceRunner } from "../../screening/instruction.js";

const mockP2P = {
    connect: vi.fn(),
    send: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    studentSetup: vi.fn(),
};

vi.mock("../../webRTC.js", () => {
    return {
        WebRTCChannel: vi.fn().mockImplementation(function () {
            return mockP2P;
        }),
    };
});

const testSpy = (test) => {
    spyAttributes(test, ["chatSocket", "domElements", "summary"]);
};
const createMockAudioContext = () => {
    const mockSource = {
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
        buffer: null,
    };

    const mockAudioContextInstance = {
        state: "suspended",
        resume: vi.fn().mockResolvedValue(),
        decodeAudioData: vi.fn().mockResolvedValue({ duration: 1.0 }),
        createBufferSource: vi.fn(() => mockSource),
        destination: {},
    };

    return { mockAudioContextInstance, mockSource };
};
const { mockAudioContextInstance, mockSource } = createMockAudioContext();
const student = new Student({
    id: 123,
    firstName: "Test",
    lastName: "Student",
});
const ws = getWebSocket();
const mockSend = vi.fn();

const SHARED_DOM_HTML = `
    <div id="fade-overlay"></div>
    <h1 id="student-header" class="student-header"></h1>
    <audio id="instructions-sound"></audio>
    <audio id="reminder-sound"></audio>
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
    <button id="end-summary"></button>
    <div id="question-challenge"></div>
    <div id="choices" class="multiple-choice-choices"></div>
    <div id="choices-row-2" class="multiple-choice-choices"></div>
    <div id="multiple-choice-match-container" class="multiple-choice-match-container" style="display: none;">
        <div id="choices-left" class="multiple-choice-choices vertical"></div>
        <div id="choices-right" class="multiple-choice-choices vertical"></div>
    </div>
    <div id="multiple-choice-answer-display" class="form-control multiple-choice-answer-display" style="display: none;"></div>
    <button id="next"></button>
    <button id="repeat"></button>
    <button id="log-out"></button>
    <div id="test-summary"></div>
    <div id="test-exit"></div>
    <div id="testpart-intro"></div>
    <div id="test-intro"></div>
    <div id="test-container"></div>
    <button id="start-testpart"></button>
    <button id="start-summary"></button>
    <h2 id="testpart-intro-text"> </h2>
    <img src="/foo" alt="img" id="testpart-intro-image">
    <button id="start-practice"></button>
    <button id="start-questions"></button>
    <div id="instructions-text"></div>
`;

global.WebSocket = class {
    constructor(url) {
        this.url = url;
        this.send = mockSend;
        this.close = vi.fn();
        this.addEventListener = vi.fn();
    }
};

// Mock window.location correctly
global.window = {
    location: { protocol: "https:", host: "example.com" },
};
global.document.timeline = {
    currentTime: 0,
};
global.alert = vi.fn();

global.fetch = vi.fn(async () => ({
    arrayBuffer: async () => new ArrayBuffer(8), // dummy audio data
}));
global.window.AudioContext = vi.fn(() => mockAudioContextInstance);
global.window.webkitAudioContext = vi.fn(() => mockAudioContextInstance);

describe("GroupTestFlow", () => {
    let domElements;

    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = SHARED_DOM_HTML;

        domElements = new GroupTestDomElements();

        spyAttributes(domElements);
        vi.spyOn(student, "progress", "set");

        vi.spyOn(utils, "unlockAudioOnGesture").mockReturnValue(
            mockAudioContextInstance,
        );
        vi.spyOn(Test.prototype, "preload").mockResolvedValue(new Map());
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        document.body.innerHTML = "";
        vi.clearAllMocks();
    });

    it("Test Structure loads", () => {
        // Test that the instance with subinstances is correctly created from json
        const test = new Test(groupTestData);
        expect(test.name).toBe("Middle 2. grade");
        expect(test.parts.length).toBe(2);
        expect(test.parts[0].test).toBe(test);
        expect(test.parts[0].id).toBe(5);
        expect(test.parts[0].index).toBe(0);
        expect(test.parts[0].name).toBe("Wordreading 2A (dummy)");
        expect(test.parts[0].instructionsUrl).toBe(null);
        expect(test.parts[0].timeout).toBe(60);
        expect(test.parts[0].partialScoreAfter).toBe(30);
        expect(test.parts[0].questions.length).toBe(5);
        expect(test.parts[0].questionIndex).toBe(0);
        expect(test.parts[0].currentQuestion).toBe(null);
        expect(test.parts[0].practice.length).toBe(3);
        expect(test.parts[0].practice[0].continueWhenInstructionIsComplete).toBe(true);
        expect(test.parts[0].practice[2].continueWhenInstructionIsComplete).toBe(false);
        expect(test.parts[0].practice[2].instruction_sequence.instructions.length).toBe(
            2,
        );
    });

    it("Test Structure loads with no practice", () => {
        // Test that the instance with subinstances is correctly created from json
        const data = structuredClone(groupTestData);
        delete data.parts[0].practice;
        delete data.parts[1].practice;
        const test = new Test(data);
        expect(test.name).toBe("Middle 2. grade");
        expect(test.parts.length).toBe(2);
        expect(test.parts[0].test).toBe(test);
        expect(test.parts[0].id).toBe(5);
        expect(test.parts[0].index).toBe(0);
        expect(test.parts[0].name).toBe("Wordreading 2A (dummy)");
        expect(test.parts[0].instructionsUrl).toBe(null);
        expect(test.parts[0].timeout).toBe(60);
        expect(test.parts[0].partialScoreAfter).toBe(30);
        expect(test.parts[0].questions.length).toBe(5);
        expect(test.parts[0].questionIndex).toBe(0);
        expect(test.parts[0].currentQuestion).toBe(null);
        expect(test.parts[0].practice.length).toBe(0);
    });

    it("should set the next button listener in start() and trigger onQuestionComplete", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 1, domElements, student);

        // Spy on onQuestionComplete to verify it gets called
        const onCompleteSpy = vi
            .spyOn(view, "onQuestionComplete")
            .mockImplementation(() => {});

        // 1. Initialize view state
        view.setPart(0);
        view.showQuestion(false, 0);
        const currentQuestion = view.currentQuestion;

        // 2. Call start()
        view.start();

        // 3. Verify the listener was registered on the DOM
        expect(domElements.setNextButtonListener).toHaveBeenCalledWith(
            expect.any(Function),
        );

        // 4. Retrieve the actual function passed to the listener and execute it
        // This simulates the user clicking the "Next" button
        const registeredListener = domElements.setNextButtonListener.mock.calls[0][0];
        registeredListener();

        // 5. Assertions
        expect(onCompleteSpy).toHaveBeenCalledWith(currentQuestion, false);
    });

    it("should set the repeat button listener in start() and trigger repeat", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 1, domElements, student);

        // Spy on onQuestionComplete to verify it gets called
        const repeatSpy = vi.spyOn(view, "repeat").mockImplementation(() => {});

        // 1. Initialize view state
        view.setPart(0);
        view.showQuestion(false, 0);

        // 2. Call start()
        view.start();

        // 3. Verify the listener was registered on the DOM
        expect(domElements.setRepeatButtonListener).toHaveBeenCalledWith(
            expect.any(Function),
        );

        // 4. Retrieve the actual function passed to the listener and execute it
        // This simulates the user clicking the "Next" button
        const registeredListener = domElements.setRepeatButtonListener.mock.calls[0][0];
        registeredListener();

        // 5. Assertions
        expect(repeatSpy).toHaveBeenCalled();
    });

    it("should hide the test part intro image when there is no previous part", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 1, domElements, student);
        testSpy(view);

        // 1. Ensure currentPart is set but previousPart remains null
        view.setPart(0);
        view.previousPart = null;

        // 2. Trigger the method
        view.showTestPartIntro();

        // 3. Assertions
        // It should show the intro container...
        expect(domElements.showTestPartIntro).toHaveBeenCalled();
        // ...but specifically hide the "success/progress" image because it's the first part
        expect(domElements.hideTestPartIntroImage).toHaveBeenCalled();
        // Verify the "show" version was NOT called
        expect(domElements.showTestPartIntroImage).not.toHaveBeenCalled();
    });

    it("should show the test part intro image when moving from part 0 to part 1", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 1, domElements, student);
        testSpy(view);

        // 1. Set up transition state (previousPart exists)
        view.setPart(0); // This sets currentPart
        view.setPart(1); // This moves currentPart to previousPart

        // 2. Trigger the method
        view.showTestPartIntro();

        // 3. Assertions
        expect(domElements.showTestPartIntroImage).toHaveBeenCalled();
        expect(domElements.setTestPartIntroText).toHaveBeenCalledWith(
            expect.stringContaining(test.parts[0].name),
        );
        expect(domElements.hideTestPartIntroImage).not.toHaveBeenCalled();
    });

    it("should setup and show skip buttons when instruction sequence starts", async () => {
        // 1. Add skip buttons to the DOM for this specific test
        document.body.innerHTML += `
            <button id="skip-instruction" style="display:none"></button>
            <button id="skip-all-instructions" style="display:none"></button>
        `;

        // 2. Re-initialize domElements to pick up the new buttons
        const localDomElements = new GroupTestDomElements();

        // 3. Create a question with an instruction sequence
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 1, localDomElements, student);

        // Mock the InstructionSequenceRunner.run to return a promise we can control
        // This prevents the "then" block from hiding buttons immediately
        let resolveSequence;
        const sequencePromise = new Promise((resolve) => {
            resolveSequence = resolve;
        });
        vi.spyOn(InstructionSequenceRunner.prototype, "run").mockReturnValue(
            sequencePromise,
        );

        const skipSpy = vi.spyOn(InstructionSequenceRunner.prototype, "skip");
        const skipAllSpy = vi.spyOn(InstructionSequenceRunner.prototype, "skipToEnd");

        // 4. Trigger showQuestion for a question that has instructions
        // (Assuming Part 0, Question 0 in your JSON has instruction_sequence)
        view.setPart(0);
        view.showQuestion(true, 0);

        // --- Assertions ---

        // Verify buttons are made visible
        expect(localDomElements.skipInstructionButton.style.display).toBe("block");
        expect(localDomElements.skipAllInstructionsButton.style.display).toBe("block");

        // Verify clicking the buttons triggers the runner methods
        localDomElements.skipInstructionButton.click();
        expect(skipSpy).toHaveBeenCalled();

        localDomElements.skipAllInstructionsButton.click();
        expect(skipAllSpy).toHaveBeenCalled();

        // 5. Complete the sequence and verify buttons are hidden again
        resolveSequence();

        // Wait for the .then() microtask in GroupTestView
        await vi.waitFor(() => {
            expect(localDomElements.skipInstructionButton.style.display).toBe("none");
            expect(localDomElements.skipAllInstructionsButton.style.display).toBe(
                "none",
            );
        });
    });

    it("should handle free_text selection and update next button state", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 1, domElements, student);
        testSpy(view);

        // 1. Move to a part that has free_text questions (Part 1 in your JSON)
        view.setPart(1);

        // 2. Show the question
        // This executes: this.input = this.domElements.showQuestionFreeText(() => this.selectFreeText());
        view.showQuestion(false, 0);

        // 3. Clear previous calls to ensure clean assertions
        domElements.toggleNextButton.mockClear();

        // 4. Simulate user typing "ab"
        // In your DOM implementation, the listener is called on every letter update
        view.input.value = "ab";

        // 5. Trigger the listener manually
        // This simulates what happens when a letter button is clicked in showQuestionFreeText
        const freeTextCall = domElements.showQuestionFreeText.mock.calls[0][0];
        freeTextCall();

        // --- Assertions ---

        // verify selectFreeText logic:
        // This.textAnswer should be updated because "ab" is not empty
        expect(view.textAnswer).toBe("ab");

        // selectedAnswer should be set to the first possible answer (resource reference)
        expect(view.selectedAnswer).toEqual(view.currentQuestion.possibleAnswers[0]);

        // toggleNextButton should be called with true (because length >= 2)
        expect(domElements.toggleNextButton).toHaveBeenCalledWith(true);
    });

    it("Test complain when there are no parts", () => {
        expect(
            () =>
                new Test(
                    {
                        id: 1,
                        name: "Middle 2. grade",
                        parts: [],
                    },
                    ws,
                    domElements,
                ),
        ).toThrowError("Test has no parts");
    });

    it("Render Summary when canPractice() = true", () => {
        const testData = JSON.parse(JSON.stringify(groupTestData));
        const test = new Test(testData);
        const view = new GroupTestView(test, ws, 1, domElements, student);
        testSpy(view);

        view.start();
        view.startSummary();

        expect(domElements.showSummary).toHaveBeenCalled();
        expect(domElements.setEndSummaryButtonListener).toHaveBeenCalledWith(
            expect.any(Function),
        );

        domElements.endSummaryButton.click();
        expect(view.endSummary).toHaveBeenCalled();
    });

    it("Render Summary when canPractice() = false", () => {
        const testData = JSON.parse(JSON.stringify(groupTestData));

        // Ensure first part has no practice questions
        testData.parts[0].practice = [];

        const test = new Test(testData);
        const view = new GroupTestView(test, ws, 1, domElements, student);
        testSpy(view);

        view.start();
        view.startSummary();

        expect(domElements.showSummary).toHaveBeenCalled();
        expect(domElements.setEndSummaryButtonListener).toHaveBeenCalledWith(
            expect.any(Function),
        );
    });

    it("Render intro and startSummary", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 1, domElements, student);

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
        const view = new GroupTestView(test, ws, 1, domElements, student);
        testSpy(view);
        view.start();
        view.endSummary();

        expect(view.currentQuestionIndex).toBe(0);
        expect(view.isPracticing).toBe(true);
        expect(view.showFirstQuestion).toHaveBeenCalledWith(true);
    });

    it("should use default parameter (false) when showFirstQuestion is called without arguments", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 1, domElements, student);

        view.start();
        view.showFirstQuestion();

        expect(view.isPracticing).toBe(false);
    });

    it("Ends summary and displays first question", () => {
        const testData = JSON.parse(JSON.stringify(groupTestData));

        // Ensure first part has no practice questions
        testData.parts[0].practice = [];

        const test = new Test(testData);
        const view = new GroupTestView(test, ws, 1, domElements, student);
        testSpy(view);
        view.start();
        view.endSummary();

        expect(view.currentQuestionIndex).toBe(0);
        expect(view.isPracticing).toBe(false);
        expect(view.showFirstQuestion).toHaveBeenCalledWith(false);
    });

    it("Trigger for first question reminder", () => {
        vi.useFakeTimers();
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 1, domElements, student);
        test.parts[0].timeout = 0;
        test.parts[0].questions[0].reminder = 5000;
        // Mock audio play
        view.domElements.reminderSoundEl.play = vi.fn();
        testSpy(view);
        view.setPart(0);
        view.showFirstQuestion(false);

        vi.runAllTimers();
        expect(view.domElements.playSound).toHaveBeenCalled();
    });

    it("Let first question time out", () => {
        vi.useFakeTimers();
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 1, domElements, student);
        test.parts[0].timeout = 0;
        test.parts[0].questions[0].timeout = 10000;
        testSpy(view);
        view.setPart(0);

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
            correct: false,
            textAnswer: null,
            student: expect.any(Object),
        });
    });

    it("Let first testpart time out on second question", () => {
        vi.useFakeTimers();
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 1, domElements, student);
        test.parts[0].timeout = 60000;
        testSpy(view);
        view.setPart(0);

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
                message: `Elev besvarede ikke spørgsmål 1.${question.index + 1} indenfor tidsfristen`,
                choiceId: null,
                recordingBase64: null,
                assignmentId: 1,
                partIndex: part.index,
                partId: part.id,
                questionIndex: question.index,
                questionId: question.id,
                questionTitle: `${question.index + 1}/${part.questions.length} (${part.name})`,
                displayedAt: 0,
                answeredAt: expect.any(Number),
                duration: expect.any(Number),
                correct: false,
                textAnswer: null,
                student: expect.any(Object),
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
            correct: expect.toBeOneOf([null, true, false]),
            textAnswer: null,
            student: expect.any(Object),
        });
    });

    it("Select second answer of first question", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 1, domElements, student);
        testSpy(view);
        view.setPart(0);

        view.showFirstQuestion(false);
        const question = view.currentQuestion;
        const secondAnswer = question.possibleAnswers[1];
        const answerButtonObj = view.answerButtons.find(
            (a) => a.answer === secondAnswer,
        );
        answerButtonObj.button.click();

        expect(view.selectedAnswer, secondAnswer);
        expect(domElements.toggleNextButton).toHaveBeenLastCalledWith(true);
        for (let d of view.answerButtons) {
            expect(domElements.toggleButtonSelected).toHaveBeenCalledWith(
                d["button"],
                d["answer"] === secondAnswer,
            );
        }
    });

    it("Go to next question", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 1, domElements, student);
        testSpy(view);
        view.setPart(0);

        const part = view.currentPart;
        view.showFirstQuestion(false);
        const question = view.currentQuestion;
        const secondAnswer = question.possibleAnswers[1];
        view.questionReminderId = 1;
        view.selectAnswer(secondAnswer);
        view.onQuestionComplete(question);
        expect(view.questionReminderId).toBe(null);

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
            student: expect.any(Object),
        });
        expect(view.onQuestionComplete).toHaveBeenCalled();
        expect(view.showNextQuestion).toHaveBeenCalled();
        expect(view.showQuestion).toHaveBeenCalledWith(false, 1);
    });

    it("plays the challenge sound on question display", () => {
        // Arrange
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 1, domElements, student);
        const spyRunInstructions = vi.spyOn(view, "runInstructions");
        const spyPlayChallengeSound = vi.spyOn(view, "playChallengeSound");
        // Arrange: go to word spelling questions (which use sound challenges)
        view.setPart(1);

        // Act: go to first non-practice question (which does not contain instructions)
        view.showQuestion(false, 0);
        vi.advanceTimersByTime(500);
        // Assert: no instruction audio is played
        expect(spyRunInstructions).not.toHaveBeenCalled();
        // Assert: the challenge audio is played
        expect(spyPlayChallengeSound).toHaveBeenCalled();

        // Act: go to second non-practice question (which also contains instructions)
        view.showQuestion(false, 1);
        vi.advanceTimersByTime(500);
        // Assert: instruction audio was played
        expect(spyRunInstructions).toHaveBeenCalled();
        // Assert: the challenge audio is played
        expect(spyPlayChallengeSound).toHaveBeenCalled();
    });

    it("Answer practice question without selecting answer", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 1, domElements, student);
        testSpy(view);
        view.setPart(0);

        view.showQuestion(true, 1);
        const question = view.currentQuestion;
        view.onQuestionComplete(question);
        expect(view.showNextQuestion).not.toHaveBeenCalled();
        expect(global.alert).toHaveBeenCalledWith("Vælg et svar, før du går videre.");
    });

    it("Answer practice question correctly", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 1, domElements, student);
        testSpy(view);
        view.setPart(0);

        view.showQuestion(true, 1);
        const question = view.currentQuestion;
        const correctAnswer = question.possibleAnswers.find((a) => a.isCorrect);
        const answerButtonObj = view.answerButtons.find(
            (a) => a.answer === correctAnswer,
        );
        answerButtonObj.button.click();
        view.onQuestionComplete(question);

        expect(view.showNextQuestion).toHaveBeenCalled();
        expect(view.domElements.makeButtonHappy).toHaveBeenCalled();
    });

    it("Answer practice question incorrectly", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 1, domElements, student);
        testSpy(view);
        view.setPart(0);

        view.showQuestion(true, 1);
        const question = view.currentQuestion;
        const incorrectAnswer = question.possibleAnswers.find((a) => !a.isCorrect);
        const answerButtonObj = view.answerButtons.find(
            (a) => a.answer === incorrectAnswer,
        );
        answerButtonObj.button.click();
        view.onQuestionComplete(question);

        expect(view.showNextQuestion).not.toHaveBeenCalled();
        expect(view.domElements.makeButtonAngry).toHaveBeenCalled();
    });

    it("Answer last practice question in part", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 1, domElements, student);
        testSpy(view);
        view.setPart(0);

        view.showQuestion(true, 2);
        const question = view.currentQuestion;
        const correctAnswer = question.possibleAnswers.find((a) => a.isCorrect);
        view.selectAnswer(correctAnswer);
        view.onQuestionComplete(question);

        expect(view.showNextQuestion).toHaveBeenCalled();
        expect(view.domElements.makeButtonHappy).toHaveBeenCalled();
    });

    it("Answer last question in part", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 1, domElements, student);
        testSpy(view);
        view.setPart(0);
        const part = view.currentPart;
        view.showQuestion(false, part.questions.length - 1);
        const question = view.currentQuestion;
        const firstAnswer = question.possibleAnswers[0];
        view.selectAnswer(firstAnswer);
        view.onQuestionComplete(question);

        expect(view.onQuestionComplete).toHaveBeenCalled();
        expect(view.onPartComplete).toHaveBeenCalled();
        expect(view.setPart).toHaveBeenCalledWith(1);

        expect(view.showTestPartIntro).toHaveBeenCalled();

        domElements.startTestPartButton.click();
        expect(view.showFirstQuestion).toHaveBeenCalled();
    });

    it("Answer freetext question correctly", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 1, domElements, student);
        testSpy(view);
        view.setPart(1);

        view.showQuestion(false, 0);
        expect(view.input).not.toBe(null);
        const question = view.currentQuestion;
        view.input.value = "aput";
        view.selectFreeText();
        view.onQuestionComplete(question);
        expect(view.send).toHaveBeenCalledWith({
            answeredAt: 0,
            assignmentId: 1,
            choiceId: 100,
            correct: true,
            displayedAt: 0,
            duration: 0,
            event: "question.answered",
            message: "Elev har gennemført spørgsmål 2.1",
            partId: 6,
            partIndex: 1,
            questionId: 25,
            questionIndex: 0,
            questionTitle: "1/2 (Wordspelling 2B (dummy))",
            recordingBase64: null,
            textAnswer: "aput",
            uuid: expect.any(String),
            student: expect.any(Object),
        });
    });

    it("Answer freetext question with empty string", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 1, domElements, student);
        testSpy(view);
        view.setPart(1);

        view.showQuestion(false, 0);
        expect(view.input).not.toBe(null);
        view.input.value = "";
        view.selectFreeText();
        expect(view.domElements.toggleNextButton).toHaveBeenCalledWith(false);
    });

    it("Answer freetext question incorrectly", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 1, domElements, student);
        testSpy(view);
        view.setPart(1);

        view.showQuestion(false, 0);
        expect(view.input).not.toBe(null);
        const question = view.currentQuestion;
        view.input.value = "forkert";
        view.selectFreeText();
        view.onQuestionComplete(question);
        expect(view.send).toHaveBeenCalledWith({
            answeredAt: 0,
            assignmentId: 1,
            choiceId: 100,
            correct: false,
            displayedAt: 0,
            duration: 0,
            event: "question.answered",
            message: "Elev har gennemført spørgsmål 2.1",
            partId: 6,
            partIndex: 1,
            questionId: 25,
            questionIndex: 0,
            questionTitle: "1/2 (Wordspelling 2B (dummy))",
            recordingBase64: null,
            textAnswer: "forkert",
            uuid: expect.any(String),
            student: expect.any(Object),
        });
    });

    it("Answer last question in last part", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 1, domElements, student);
        testSpy(view);
        const canShow = view.setPart(test.parts.length - 1);
        expect(canShow).toBe(true);
        const part = view.currentPart;
        view.showQuestion(false, part.questions.length - 1);
        const question = view.currentQuestion;
        view.input.value = "iki";
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
            student: expect.any(Object),
        });
    });

    it("Answer question with instruction sequence", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 1, domElements, student);
        testSpy(view);
        const canShow = view.setPart(0);
        expect(canShow).toBe(true);
        view.showQuestion(true, 0);
        const question = view.currentQuestion;
        view.onQuestionComplete(question);
        expect(view.showNextQuestion).toHaveBeenCalled();
    });

    it("Show instructions", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 1, domElements, student);
        testSpy(view);
        view.setPart(0);
        view.showQuestion(true, 0);
        expect(domElements.setStudentHeader).toHaveBeenCalledWith(
            '<i class="ph ph-ear"></i>',
        );
        expect(view.runInstructions).toHaveBeenCalledWith(expect.any(Function));
    });
});

describe("GroupTestDomElements - showQuestionFreeText", () => {
    let domElements;
    let listenerMock;

    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = SHARED_DOM_HTML;

        domElements = new GroupTestDomElements();
        listenerMock = vi.fn();
        vi.spyOn(Test.prototype, "preload").mockResolvedValue(new Map());
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        document.body.innerHTML = "";
        vi.clearAllMocks();
    });

    it("prevents default browser context menu on the display field", () => {
        const displayField = domElements.showQuestionFreeText(listenerMock);

        // 1. Create a real ContextMenu event
        const event = new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
        });

        // 2. Manually mock preventDefault on this specific event instance
        // This ensures the spy works even if JSDOM's internal event handling is rigid
        const preventDefaultSpy = vi.fn();
        Object.defineProperty(event, "preventDefault", {
            value: preventDefaultSpy,
            writable: true,
        });

        // 3. Dispatch to the input field
        displayField.dispatchEvent(event);

        // 4. Verify the call
        expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it("renders free text input with letters and erase button", () => {
        const displayField = domElements.showQuestionFreeText(listenerMock);

        // Display field exists
        expect(displayField).toBeInstanceOf(HTMLElement);
        expect(displayField.classList.contains("display-field")).toBe(true);

        // Letter buttons exist
        const letterButtons = document.querySelectorAll(".letter-btn");
        letterButtons.forEach((b) => (b.disabled = false));
        expect(letterButtons.length).toBe(18); // 3 rows * 6 letters

        // Erase button exists
        const eraseBtn = document.querySelector(".erase-btn");
        expect(eraseBtn).toBeInstanceOf(HTMLElement);
        expect(eraseBtn.disabled).toBe(true); // initially disabled

        // Click a letter button
        letterButtons[0].click(); // should append "a" to display
        expect(displayField.value).toBe("a");
        expect(listenerMock).toHaveBeenCalledWith({ target: { value: "a" } });
        expect(eraseBtn.disabled).toBe(false);

        // Click erase button
        eraseBtn.click();
        expect(displayField.value).toBe("");
        expect(listenerMock).toHaveBeenCalledWith({ target: { value: "" } });
        expect(eraseBtn.disabled).toBe(true);
    });

    it("supports multiple letters and listener calls", () => {
        const displayField = domElements.showQuestionFreeText(listenerMock);
        const letterButtons = document.querySelectorAll(".letter-btn");
        const eraseBtn = document.querySelector(".erase-btn");

        // Type "abc"
        letterButtons.forEach((b) => (b.disabled = false));
        letterButtons[0].click();
        letterButtons[1].click();
        letterButtons[2].click();
        expect(displayField.value).toBe("aef"); // first row letters: a, e, f, g, i, j
        expect(listenerMock).toHaveBeenCalledTimes(3);

        // Erase last letter
        eraseBtn.click();
        expect(displayField.value).toBe("ae");
    });

    it("returns the display field element", () => {
        const displayField = domElements.showQuestionFreeText(() => {});
        expect(displayField).toBeInstanceOf(HTMLElement);
        expect(displayField.classList.contains("display-field")).toBe(true);
    });
});

describe("GroupTestDomElements - showQuestionChallenge", () => {
    let domElements;

    let mockAudioContext;

    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = SHARED_DOM_HTML;
        domElements = new GroupTestDomElements();

        mockAudioContext = mockAudioContextInstance;
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        document.body.innerHTML = "";
        vi.clearAllMocks();
    });

    it("displays a question with sound correctly", async () => {
        const soundUrl = "https://example.com/audio.mp3";

        domElements.showQuestionChallenge(null, soundUrl, null, mockAudioContext);

        // Play button exists
        const playBtn = document.getElementById("challenge-sound-btn");
        expect(playBtn).toBeInstanceOf(HTMLButtonElement);
        expect(playBtn.classList.contains("pulse")).toBe(true);

        // Click play button
        playBtn.click();

        // Audio should be played and pulse removed
        expect(playBtn.classList.contains("pulse")).toBe(false);
    });

    it("removes audio and play button if sound is removed", async () => {
        const soundUrl = "https://example.com/audio.mp3";
        domElements.showQuestionChallenge(null, soundUrl, null, mockAudioContext);

        // Now call again with no sound
        domElements.showQuestionChallenge("Test", null, null, mockAudioContext);

        const audioEl = document.getElementById("challenge-audio");
        const playBtn = document.getElementById("challenge-sound-btn");

        expect(audioEl).toBeNull();
        expect(playBtn).toBeNull();
    });

    it("displays a question with an image correctly", async () => {
        const imageUrl = "https://example.com/image.png";

        domElements.showQuestionChallenge(null, null, imageUrl, mockAudioContext);

        // Image element should exist
        const imgEl = document.querySelector("#challenge-image");
        expect(imgEl).toBeInstanceOf(HTMLImageElement);
        expect(imgEl.src).toBe(imageUrl);

        // Image element should be removed when called with text
        domElements.showQuestionChallenge("foo", null, null, mockAudioContext);
        const removedImg = document.querySelector("#challenge-image");
        expect(removedImg).toBeNull();
    });

    it("replaces image when a new image URL is given", async () => {
        const firstImage = "https://example.com/first.png";
        const secondImage = "https://example.com/second.png";

        domElements.showQuestionChallenge(null, null, firstImage, mockAudioContext);
        let imgEl = document.querySelector("#challenge-image");
        expect(imgEl.src).toBe(firstImage);

        domElements.showQuestionChallenge(null, null, secondImage, mockAudioContext);
        imgEl = document.querySelector("#challenge-image");
        expect(imgEl.src).toBe(secondImage);
    });

    it("enables all letter buttons and input field when audio is played", async () => {
        // First, create some disabled letter buttons
        const letterBtn1 = document.createElement("button");
        letterBtn1.className = "letter-btn";
        letterBtn1.disabled = true;
        const letterBtn2 = document.createElement("button");
        letterBtn2.className = "letter-btn";
        letterBtn2.disabled = true;

        const inputField = document.createElement("input");
        inputField.className = "display-field";
        inputField.disabled = true;

        document.body.append(letterBtn1, letterBtn2, inputField);

        // Set up audio challenge
        const soundUrl = "https://example.com/audio.mp3";
        domElements.showQuestionChallenge(null, soundUrl, null, mockAudioContext);

        const playBtn = document.getElementById("challenge-sound-btn");

        // Before clicking, buttons are disabled
        expect(letterBtn1.disabled).toBe(true);
        expect(letterBtn2.disabled).toBe(true);
        expect(inputField.disabled).toBe(true);

        // Click play
        playBtn.click();

        await vi.waitFor(() => {
            expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
        });

        // Buttons are still disabled before audio ends
        expect(letterBtn1.disabled).toBe(true);
        expect(letterBtn2.disabled).toBe(true);
        expect(inputField.disabled).toBe(true);

        // Manually trigger audio.onended
        mockSource.onended();

        // Let the handler finish
        await vi.waitFor(() => {
            expect(letterBtn1.disabled).toBe(false);
        });

        // Buttons should now be enabled
        expect(letterBtn1.disabled).toBe(false);
        expect(letterBtn2.disabled).toBe(false);
        expect(inputField.disabled).toBe(false);

        // Play button classes updated correctly
        expect(playBtn.classList.contains("playing")).toBe(false);
    });

    it("blocks double-click", async () => {
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
        domElements.showQuestionChallenge(null, soundUrl, null, mockAudioContext);

        const playBtn = document.getElementById("challenge-sound-btn");

        // Click play twice
        playBtn.click();
        playBtn.click();

        await vi.waitFor(() => {
            expect(mockAudioContext.createBufferSource).toHaveBeenCalledTimes(1);
        });
    });
});

describe("GroupTestDomElements - Repeatbutton", () => {
    let domElements;

    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = SHARED_DOM_HTML;
        domElements = new GroupTestDomElements();
        vi.spyOn(Test.prototype, "preload").mockResolvedValue(new Map());
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        document.body.innerHTML = "";
        vi.clearAllMocks();
    });

    it("repeat button destination", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(
            test,
            {
                addEventListener: vi.fn(),
                send: vi.fn(),
            },
            1,
            domElements,
            student,
        );
        testSpy(view);
        view.setRepeatDestination(1);
        view.setPart(0);
        view.setQuestion(true, 3);
        view.showQuestion = vi.fn();
        expect(view.repeatQuestionIndex).toBe(1);
        view.repeat();
        expect(view.showQuestion).toHaveBeenCalledWith(true, 1);
    });

    it("should repeat the CURRENT question if no repeat destination is set", () => {
        const test = new Test(groupTestData);
        const view = new GroupTestView(test, ws, 1, domElements, student);
        testSpy(view);

        view.setPart(0);
        // Set to index 2 specifically
        view.setQuestion(false, 2);

        // Ensure repeatQuestionIndex is null (the default state)
        view.repeatQuestionIndex = null;

        // Spy on showQuestion to see what index it gets called with
        const showQuestionSpy = vi.spyOn(view, "showQuestion");

        view.repeat();

        // It should fall back to currentQuestionIndex (2)
        expect(showQuestionSpy).toHaveBeenCalledWith(false, 2);
    });
});

describe("compareTextAnswer", () => {
    let view;
    let domElements;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(global, "clearTimeout");

        vi.spyOn(utils, "unlockAudioOnGesture").mockReturnValue(
            mockAudioContextInstance,
        );

        const test = new Test(groupTestData);
        domElements = new GroupTestDomElements();
        view = new GroupTestView(test, ws, 1, domElements, student);
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        document.body.innerHTML = "";
        vi.clearAllMocks();
    });

    it("Ignores whitespace", () => {
        expect(view.compareTextAnswer("ulu", "ulu")).toBe(true);
        expect(view.compareTextAnswer("ulu ", "ulu")).toBe(true);
        expect(view.compareTextAnswer("ul u", "ulu")).toBe(true);
        expect(view.compareTextAnswer(" ulu", "ulu ")).toBe(true);
        expect(view.compareTextAnswer("uulu", "ulu")).toBe(false);
    });

    it("Ignores case", () => {
        expect(view.compareTextAnswer("Ulu", "ulu")).toBe(true);
        expect(view.compareTextAnswer("uLu", "ulu")).toBe(true);
    });

    it("Ignores doubled consonants", () => {
        expect(view.compareTextAnswer("ullu", "ulu")).toBe(true);
        expect(view.compareTextAnswer("mattu", "matu")).toBe(true);
        expect(view.compareTextAnswer("matu", "mattu")).toBe(true);
        expect(view.compareTextAnswer("matttu", "matu")).toBe(false);
    });

    it("Ignores use of similar vowels", () => {
        expect(view.compareTextAnswer("iq", "eq")).toBe(true);
        expect(view.compareTextAnswer("ulu", "alu")).toBe(false);
    });
});

describe("Timer and Reminder Cleanup", () => {
    let view;
    let domElements;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(global, "clearTimeout");

        document.body.innerHTML = SHARED_DOM_HTML;

        vi.spyOn(utils, "unlockAudioOnGesture").mockReturnValue(
            mockAudioContextInstance,
        );

        const test = new Test(groupTestData);

        domElements = new GroupTestDomElements();
        view = new GroupTestView(test, ws, 1, domElements, student);

        // Use a part/question we know is multiple_choice to avoid free_text logic crashes
        view.setPart(0);
        view.setQuestion(false, 0);
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.clearAllTimers();
        vi.useRealTimers();
        document.body.innerHTML = "";
    });

    it("should clear both timers when onQuestionComplete is called", () => {
        view.questionTimeoutId = 123;
        view.questionReminderId = 456;

        // 1. Ensure we aren't practicing (avoids answerIsCorrect check in some paths)
        view.isPracticing = false;

        // 2. Mock a multiple choice selection
        // This prevents the code from falling back to textAnswer logic
        view.selectedAnswer = { id: 1, isCorrect: true, buttonId: "btn1" };
        view.textAnswer = null;

        view.onQuestionComplete(view.currentQuestion);

        expect(clearTimeout).toHaveBeenCalledWith(123);
        expect(clearTimeout).toHaveBeenCalledWith(456);
        expect(view.questionTimeoutId).toBeNull();
        expect(view.questionReminderId).toBeNull();
    });

    it("should clear reminder specifically when user interacts via selectFreeText", () => {
        view.questionReminderId = 777;
        view.input = { value: "A" };

        view.selectFreeText();

        // This confirms the timer was actually stopped in the browser
        expect(clearTimeout).toHaveBeenCalledWith(777);
    });

    it("should clear existing timers when a new question is displayed", () => {
        view.questionTimeoutId = 111;
        view.questionReminderId = 222;

        // Mock current question to have a timeout/reminder so new ones are set
        view.currentQuestion.timeout = 5000;
        view.currentQuestion.reminder = 2000;

        view.showQuestion(false, 0);

        expect(clearTimeout).toHaveBeenCalledWith(111);
        expect(clearTimeout).toHaveBeenCalledWith(222);
    });
});

describe("StudentTestView - updateNextButtonClass", () => {
    let view;
    let domElements;

    beforeEach(() => {
        vi.useFakeTimers();
        const test = new Test(groupTestData);

        document.body.innerHTML = SHARED_DOM_HTML;

        domElements = new GroupTestDomElements();
        spyAttributes(domElements);

        view = new GroupTestView(test, ws, 1, domElements, student);
        testSpy(view);
        view.setPart(0);
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.clearAllTimers();
        vi.useRealTimers();
        document.body.innerHTML = "";
    });

    it("Set button to round class on entry", () => {
        view.setPart(0);
        view.setQuestion(true, 0);
        view.updateNextButtonClass();
        expect(domElements.nextBtn.classList).toContain("start-btn");
    });

    it("Set button to round class on playing intro", () => {
        view.setPart(0);
        view.setQuestion(true, 1);
        view.showingIntro = true;
        view.updateNextButtonClass();
        expect(domElements.nextBtn.classList).toContain("start-btn");
    });

    it("should set 'start-part-btn' (Blue) on the last practice question", () => {
        view.isPracticing = true;
        // Move to the index of the last practice question
        const lastIndex = view.currentPart.practice.length - 1;
        view.setQuestion(true, lastIndex);

        view.updateNextButtonClass();

        expect(domElements.setNextButtonClass).toHaveBeenCalledWith("start-part-btn");
    });

    it("should set 'start-btn' (Round) on the very first practice question", () => {
        view.isPracticing = true;
        view.setQuestion(true, 0);

        // Ensure showingIntro is false to hit this specific block
        view.showingIntro = false;

        view.updateNextButtonClass();

        expect(domElements.setNextButtonClass).toHaveBeenCalledWith("start-btn");
    });

    it("should set 'start-btn' (Round) when showingIntro is true", () => {
        view.isPracticing = true;
        view.setQuestion(true, 1); // Middle question
        view.showingIntro = true;

        view.updateNextButtonClass();

        expect(domElements.setNextButtonClass).toHaveBeenCalledWith("start-btn");
    });

    it("should set 'start-btn' (Round) when transitioning from instructions to a normal question", () => {
        view.isPracticing = true;

        // Setup: Current question has instructions, next one does NOT
        view.currentPart.practice[0].instruction_sequence = { instructions: [] };
        view.currentPart.practice[1].instruction_sequence = null;

        view.setQuestion(true, 0);
        view.showingInstructions = false; // We just finished showing them

        view.updateNextButtonClass();

        expect(domElements.setNextButtonClass).toHaveBeenCalledWith("start-btn");
    });

    it("should default to 'next-btn' (Green) for standard test questions", () => {
        // Standard test mode (not practicing)
        view.isPracticing = false;
        view.setQuestion(false, 1);

        view.updateNextButtonClass();

        expect(domElements.setNextButtonClass).toHaveBeenCalledWith("next-btn");
    });

    it("should set 'start-btn' via the instruction-to-task transition logic", () => {
        view.isPracticing = true;
        view.showingIntro = false;
        view.showingInstructions = false;

        // We need at least 3 questions to avoid hitting the "First" or "Last" checks
        view.currentPart.practice = [
            { instruction_sequence: { instructions: [] } }, // Index 0 (Has instruction)
            { instruction_sequence: { instructions: [] } }, // Index 1 (CURRENT - Has instruction)
            { instruction_sequence: null }, // Index 2 (NEXT - No instruction)
            { instruction_sequence: null }, // Index 3 (Buffer to not be "Last")
        ];

        // Set to index 1
        // 1. It's not index 0 (First check failed)
        // 2. It's not index 3 (Last check failed)
        // 3. practice.slice(0, 2) are all instructions (Every check passed)
        // 4. practice[2] is NOT an instruction (Next check passed)
        view.setQuestion(true, 1);

        view.updateNextButtonClass();

        expect(domElements.setNextButtonClass).toHaveBeenCalledWith("start-btn");
    });

    it("should NOT set 'start-btn' if the next question also has instructions", () => {
        view.isPracticing = true;
        view.currentPart.practice = [
            { instruction_sequence: {} },
            { instruction_sequence: {} }, // Current
            { instruction_sequence: {} }, // Next (This causes the block to fail)
            { instruction_sequence: {} },
        ];

        view.setQuestion(true, 1);
        view.updateNextButtonClass();

        // Should fall through to the default class
        expect(domElements.setNextButtonClass).toHaveBeenCalledWith("next-btn");
    });
});

describe("GroupTestDomElements - FreeText Touch Interaction", () => {
    let domElements;
    let listenerMock;
    let displayField;

    beforeEach(() => {
        vi.useFakeTimers();
        // 1. Reset DOM
        document.body.innerHTML = SHARED_DOM_HTML;

        // 2. Initialize Class & Mocks
        domElements = new GroupTestDomElements();
        listenerMock = vi.fn();

        // 3. Common Element Setup
        displayField = domElements.showQuestionFreeText(listenerMock);
        document.body.appendChild(displayField);

        // 4. Global Mocking (Ensure getComputedStyle exists in JSDOM)
        if (typeof window.getComputedStyle !== "function") {
            window.getComputedStyle = vi.fn();
        }

        // 5. Default Layout Mocks (Can be overridden in specific tests)
        vi.spyOn(displayField, "getBoundingClientRect").mockReturnValue({
            left: 50,
            top: 50,
            width: 300,
            height: 50,
        });
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        // Automatically restore all spies created via vi.spyOn
        vi.restoreAllMocks();
        // Clean up DOM to prevent memory leaks or ID collisions
        document.body.innerHTML = "";
        vi.clearAllMocks();
    });

    it("touchstart on display field calculates cursor index and sets focus", () => {
        const getCursorIndexSpy = vi.spyOn(utils, "getCursorIndex").mockReturnValue(5);
        vi.spyOn(window, "getComputedStyle").mockReturnValue({ paddingLeft: "10px" });
        const focusSpy = vi.spyOn(displayField, "focus");
        const selectionSpy = vi.spyOn(displayField, "setSelectionRange");

        const touchEvent = new Event("touchstart", { bubbles: true, cancelable: true });
        Object.defineProperty(touchEvent, "touches", {
            value: [{ clientX: 120, clientY: 60 }],
        });

        displayField.dispatchEvent(touchEvent);

        expect(touchEvent.defaultPrevented).toBe(true);
        expect(focusSpy).toHaveBeenCalled();
        expect(getCursorIndexSpy).toHaveBeenCalledWith(displayField, 60); // 120 - 50 - 10
        expect(selectionSpy).toHaveBeenCalledWith(5, 5);
    });

    it("defaults paddingLeft to 0 if getComputedStyle returns an invalid value", () => {
        const getCursorIndexSpy = vi.spyOn(utils, "getCursorIndex").mockReturnValue(0);
        vi.spyOn(window, "getComputedStyle").mockReturnValue({
            paddingLeft: undefined,
        });

        const touchEvent = new Event("touchstart", { bubbles: true, cancelable: true });
        Object.defineProperty(touchEvent, "touches", {
            value: [{ clientX: 100, clientY: 60 }],
        });

        displayField.dispatchEvent(touchEvent);

        expect(getCursorIndexSpy).toHaveBeenCalledWith(displayField, 50); // 100 - 50 - 0
    });
});

describe("LetterSoundTest", () => {
    let domElements;

    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = SHARED_DOM_HTML;

        domElements = new GroupTestDomElements();
        spyAttributes(domElements);

        vi.spyOn(utils, "unlockAudioOnGesture").mockReturnValue(
            mockAudioContextInstance,
        );
        vi.spyOn(Test.prototype, "preload").mockResolvedValue(new Map());
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        document.body.innerHTML = "";
        vi.clearAllMocks();
    });

    it("Increases font size on answerButton objects", async () => {
        const test = new Test(letterSoundTestData);
        const view = new GroupTestView(test, ws, 1, domElements, student);
        view.setPart(0);
        view.showFirstQuestion(false);

        const answerButtonObj = view.answerButtons[0];
        expect(answerButtonObj.button.style.fontSize).toBe("72px");
    });

    it("Plays sound when button is clicked", async () => {
        const test = new Test(letterSoundTestData);
        const view = new GroupTestView(test, ws, 1, domElements, student);
        view.setPart(0);
        view.showFirstQuestion(false);

        const playBtn = document.getElementById("challenge-sound-btn");

        playBtn.click();

        await vi.waitFor(() => {
            expect(mockAudioContextInstance.createBufferSource).toHaveBeenCalled();
        });

        const mockSource =
            mockAudioContextInstance.createBufferSource.mock.results[0].value;
        mockSource.onended();

        await vi.waitFor(() => {
            expect(playBtn.classList.contains("playing")).toBe(false);
        });
    });
});

describe("LetterNameTest", () => {
    let domElements;

    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = SHARED_DOM_HTML;

        domElements = new GroupTestDomElements();
        spyAttributes(domElements);

        vi.spyOn(utils, "unlockAudioOnGesture").mockReturnValue(
            mockAudioContextInstance,
        );
        vi.spyOn(Test.prototype, "preload").mockResolvedValue(new Map());
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        document.body.innerHTML = "";
        vi.clearAllMocks();
    });

    it("Updates display field when a button is pressed", async () => {
        const test = new Test(letterNameTestData);
        const view = new GroupTestView(test, ws, 1, domElements, student);
        view.setPart(0);
        view.showFirstQuestion(false);

        const MultipleChoicedisplay = document.getElementById(
            "multiple-choice-answer-display",
        );
        const answerButtonObj = view.answerButtons[0];

        expect(MultipleChoicedisplay.innerHTML).toBe("");
        expect(MultipleChoicedisplay.style.display).toBe("flex");
        answerButtonObj.button.click();
        expect(MultipleChoicedisplay.innerHTML).toBe(answerButtonObj.button.innerHTML);
    });
});

describe("Sentence Reading Test", () => {
    let domElements;

    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = SHARED_DOM_HTML;

        domElements = new GroupTestDomElements();
        spyAttributes(domElements);

        vi.spyOn(utils, "unlockAudioOnGesture").mockReturnValue(
            mockAudioContextInstance,
        );
        vi.spyOn(Test.prototype, "preload").mockResolvedValue(new Map());
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        document.body.innerHTML = "";
        vi.clearAllMocks();
    });

    it("Displays both image and text", async () => {
        const test = new Test(sentenceReadingTestData);
        const view = new GroupTestView(test, ws, 1, domElements, student);
        view.setPart(0);
        view.showFirstQuestion(false);

        const challengeImage = document.getElementById("challenge-image");

        const challengeText = document.getElementById("challenge-text");

        expect(challengeImage.src.endsWith("static/blomst.jpg")).toBe(true);
        expect(challengeText.innerHTML).toBe("Jeg er en blomst");
    });

    it("Dims True when False is clicked and the other way around", async () => {
        const test = new Test(sentenceReadingTestData);
        const view = new GroupTestView(test, ws, 1, domElements, student);
        view.setPart(0);
        view.showFirstQuestion(false);

        const trueButton = document.getElementById("choice-true");
        const falseButton = document.getElementById("choice-false");

        expect(trueButton.classList).not.toContain("dimmed");
        expect(falseButton.classList).not.toContain("dimmed");

        trueButton.click();
        expect(trueButton.classList).not.toContain("dimmed");
        expect(falseButton.classList).toContain("dimmed");

        falseButton.click();
        expect(trueButton.classList).toContain("dimmed");
        expect(falseButton.classList).not.toContain("dimmed");
    });

    it("Resets button states when a button is clicked again", async () => {
        const test = new Test(sentenceReadingTestData);
        const view = new GroupTestView(test, ws, 1, domElements, student);
        view.setPart(0);
        view.showFirstQuestion(false);

        const trueButton = document.getElementById("choice-true");
        const falseButton = document.getElementById("choice-false");

        expect(trueButton.classList).not.toContain("dimmed");
        expect(falseButton.classList).not.toContain("dimmed");

        trueButton.click();
        expect(trueButton.classList).not.toContain("dimmed");
        expect(falseButton.classList).toContain("dimmed");
        expect(trueButton.classList).toContain("selected");

        trueButton.click();
        expect(trueButton.classList).not.toContain("dimmed");
        expect(falseButton.classList).not.toContain("dimmed");
        expect(trueButton.classList).not.toContain("selected");
    });

    it("Resets button states when a non-button element is clicked", async () => {
        const test = new Test(sentenceReadingTestData);
        const view = new GroupTestView(test, ws, 1, domElements, student);
        view.start();
        view.setPart(0);
        view.showFirstQuestion(false);

        const trueButton = document.getElementById("choice-true");
        const falseButton = document.getElementById("choice-false");
        const questionChallenge = document.getElementById("question-challenge");

        expect(trueButton.classList).not.toContain("dimmed");
        expect(falseButton.classList).not.toContain("dimmed");

        trueButton.click();
        expect(trueButton.classList).not.toContain("dimmed");
        expect(falseButton.classList).toContain("dimmed");
        expect(trueButton.classList).toContain("selected");

        questionChallenge.click();
        expect(trueButton.classList).not.toContain("dimmed");
        expect(falseButton.classList).not.toContain("dimmed");
        expect(trueButton.classList).not.toContain("selected");
    });

    it("Adds no-hover class when unselecting and removes it on pointerleave", async () => {
        const test = new Test(sentenceReadingTestData);
        const view = new GroupTestView(test, ws, 1, domElements, student);
        view.start();
        view.setPart(0);
        view.showFirstQuestion(false);

        const trueButton = document.getElementById("choice-true");

        trueButton.click();
        expect(trueButton.classList).toContain("selected");

        trueButton.click();
        expect(trueButton.classList).not.toContain("selected");

        // After unselecting, no-hover should be applied
        expect(trueButton.classList).toContain("no-hover");

        // Simulate the pointer leaving the button
        trueButton.dispatchEvent(new Event("pointerleave"));

        // no-hover should now be removed
        expect(trueButton.classList).not.toContain("no-hover");
    });
});

describe("Letter Shape Test", () => {
    let domElements;

    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = SHARED_DOM_HTML;

        domElements = new GroupTestDomElements();
        spyAttributes(domElements);

        vi.spyOn(utils, "unlockAudioOnGesture").mockReturnValue(
            mockAudioContextInstance,
        );
        vi.spyOn(Test.prototype, "preload").mockResolvedValue(new Map());
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        document.body.innerHTML = "";
        vi.clearAllMocks();
    });

    it("Updates elements and correctly identifies the correct answer", async () => {
        const test = new Test(letterShapeTestData);
        const view = new GroupTestView(test, ws, 1, domElements, student);
        view.setPart(0);
        view.showFirstQuestion(false);

        const leftRow = document.getElementById("choices-left");
        const rightRow = document.getElementById("choices-right");

        // Assert that there are two buttons in each row
        expect(leftRow.children.length).toBe(2);
        expect(rightRow.children.length).toBe(2);

        // Assert that the left row contains the buttons "S" and "B"
        const leftTexts = Array.from(leftRow.children).map((btn) => btn.textContent);
        expect(leftTexts).toContain("S");
        expect(leftTexts).toContain("B");

        // Assert that the right row contains the buttons "s" and "a"
        const rightTexts = Array.from(rightRow.children).map((btn) => btn.textContent);
        expect(rightTexts).toContain("s");
        expect(rightTexts).toContain("a");

        // Click the S button
        const sBtn = Array.from(leftRow.children).find(
            (btn) => btn.textContent === "S",
        );
        sBtn.click();

        // Validate that the next button is still hidden
        expect(domElements.toggleNextButton).not.toHaveBeenCalledWith(true);

        // CLick the s button
        const lowerSBtn = Array.from(rightRow.children).find(
            (btn) => btn.textContent === "s",
        );
        lowerSBtn.click();

        // Validate that the next button is now visible
        expect(domElements.toggleNextButton).toHaveBeenCalledWith(true);

        // Validate that the answer is correct
        expect(view.answerIsCorrect()).toBe(true);

        // CLick the a button
        const lowerABtn = Array.from(rightRow.children).find(
            (btn) => btn.textContent === "a",
        );
        lowerABtn.click();

        // Validate that the answer is incorrect
        expect(view.answerIsCorrect()).toBe(false);
    });

    it("Allows proceeding from practice question when both answers are correct", async () => {
        const test = new Test(letterShapeTestData);
        const view = new GroupTestView(test, ws, 1, domElements, student);
        view.setPart(0);
        view.showFirstQuestion(true);

        const leftRow = document.getElementById("choices-left");
        const rightRow = document.getElementById("choices-right");
        const nextButton = document.getElementById("next");

        const lowerSBtn = Array.from(rightRow.children).find(
            (btn) => btn.textContent === "s",
        );
        const sBtn = Array.from(leftRow.children).find(
            (btn) => btn.textContent === "S",
        );
        const lowerABtn = Array.from(rightRow.children).find(
            (btn) => btn.textContent === "a",
        );

        // Click the S button
        sBtn.click();

        // CLick the a button
        lowerABtn.click();

        // Validate that the next button is not clickable
        expect(nextButton.disabled).toBe(true);

        // CLick the s button
        lowerSBtn.click();

        // Validate that the next button is now clickable
        expect(nextButton.disabled).toBe(false);
    });

    it("Disabled next button when both answers are wrong", async () => {
        const test = new Test(letterShapeTestData);
        const view = new GroupTestView(test, ws, 1, domElements, student);
        view.setPart(0);
        view.showFirstQuestion(true);

        const leftRow = document.getElementById("choices-left");
        const rightRow = document.getElementById("choices-right");
        const nextButton = document.getElementById("next");

        const bBtn = Array.from(leftRow.children).find(
            (btn) => btn.textContent === "B",
        );
        const lowerABtn = Array.from(rightRow.children).find(
            (btn) => btn.textContent === "a",
        );

        // Click the B button
        bBtn.click();

        // CLick the a button
        lowerABtn.click();

        // Validate that the next button is not clickable
        expect(nextButton.disabled).toBe(true);
    });
});
