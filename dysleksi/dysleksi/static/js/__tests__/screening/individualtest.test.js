/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { IndividualTestView } from "../../screening/individual/student-individual-test.js";
import { Student } from "../../screening/model.js";
import * as individualTestData from "./individualtest.json" with { type: "json" };
import { getWebSocket } from "../../ws";
import { IndividualTestDomElements } from "../../screening/dom.js";
import { Test } from "../../screening/model.js";
import { StudentTestView } from "../../screening/student-test.js";
import { spyAttributes } from "../utils.js";
import * as utils from "../../screening/utils.js";
import { InstructionSequenceRunner } from "../../screening/instruction.js";
import { MockAudioContext } from "../mock_audio.js";

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

describe("IndividualTestFlow", () => {
    let mockSend;
    let view;
    let test;
    let domElements;
    let mediaRecorder;
    let ws;
    let testSpy;
    let student;
    let stopSpy;
    let p2pListener;

    beforeEach(() => {
        vi.useFakeTimers();
        global.window = {
            location: { protocol: "https:", host: "example.com" },
            AudioContext: MockAudioContext,
        };
        global.document.timeline = {
            currentTime: 0,
        };

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

        document.body.innerHTML = `
            <div id="fade-overlay" style="opacity: 0;"></div>
            <div id="audio-indicator" style="display: none"></div>
            <h1 id="student-header" class="student-header"></h1>
            <audio id="instructions-sound"></audio>
            <audio id="reminder-sound"></audio>
            <button id="end-summary"></button>
            <div id="question-challenge"></div>
            <div id="test-summary"></div>
            <div id="test-container"></div>
            <div id="testpart-outro"></div>
            <div id="test-intro"></div>
            <button id="next"></button>
            <button id="repeat"></button>
            <button id="start-testpart"></button>
            <button id="end-testpart-outro"></button>
            <div id="choices"></div>
            <h2 id="testpart-outro-text"> </h2>
            <img id="testpart-outro-image">
            <button id="skip-instruction" style="display:none"></button>
            <button id="skip-all-instructions" style="display:none"></button>
        `;

        domElements = new IndividualTestDomElements();
        student = new Student({ id: 1 });
        spyAttributes(domElements);

        testSpy = (test) => {
            // Apply spying to a test instance
            spyAttributes(test, ["chatSocket", "domElements", "summary"]);
        };

        ws = getWebSocket("class_123");
        mediaRecorder = {
            start: vi.fn(),
            stop: vi.fn(),
            streamn: vi.fn(),
        };
        mediaRecorder.interval = vi.fn().mockResolvedValue("BASE64_AUDIO");

        stopSpy = vi.fn().mockResolvedValue(undefined);
        mediaRecorder.stop = stopSpy;

        vi.spyOn(utils, "unlockAudioOnGesture").mockReturnValue({});
        vi.spyOn(Test.prototype, "preload").mockResolvedValue(new Map());

        mockP2P.addEventListener.mockImplementation((eventName, cb) => {
            if (eventName === "message") p2pListener = cb;
        });

        test = new Test(individualTestData);
        view = new IndividualTestView(test, ws, 1, domElements, mediaRecorder, student);
        testSpy(view);
    });

    it("Test Structure loads", () => {
        // Test that the instance with subinstances is correctly created from json
        const test = new Test(individualTestData);
        expect(test.name).toBe("Individuel test");
        expect(test.parts.length).toBe(3);
        expect(test.parts[0].test).toBe(test);
        expect(test.parts[0].id).toBe(1);
        expect(test.parts[0].index).toBe(0);
        expect(test.parts[0].name).toBe("Individuel deltest");
        expect(test.parts[0].instructionsUrl).toBe(null);
        expect(test.parts[0].timeout).toBe(60000);
        expect(test.parts[0].partialScoreAfter).toBe(30000);
        expect(test.parts[0].questions.length).toBe(3);
        expect(test.parts[0].questionIndex).toBe(0);
        expect(test.parts[0].currentQuestion).toBe(null);
    });

    it("should setup and show skip buttons during instruction sequence", async () => {
        let resolveSequence;
        const sequencePromise = new Promise((resolve) => {
            resolveSequence = resolve;
        });

        // Spy on prototype before instantiation
        const runSpy = vi
            .spyOn(InstructionSequenceRunner.prototype, "run")
            .mockReturnValue(sequencePromise);
        const skipSpy = vi.spyOn(InstructionSequenceRunner.prototype, "skip");
        const skipAllSpy = vi.spyOn(InstructionSequenceRunner.prototype, "skipToEnd");

        // 3. Trigger question with instructions
        view.setPart(0);
        view.showQuestion(true, 0);

        // --- Assertions ---

        // Verify visibility
        expect(domElements.skipInstructionButton.style.display).toBe("block");
        expect(domElements.skipAllInstructionsButton.style.display).toBe("block");

        // Verify button clicks link to runner methods
        domElements.skipInstructionButton.click();
        expect(skipSpy).toHaveBeenCalled();

        domElements.skipAllInstructionsButton.click();
        expect(skipAllSpy).toHaveBeenCalled();

        // 4. Resolve and verify cleanup
        resolveSequence();

        await vi.waitFor(() => {
            expect(domElements.skipInstructionButton.style.display).toBe("none");
            expect(domElements.skipAllInstructionsButton.style.display).toBe("none");
        });

        // Clean up spies
        runSpy.mockRestore();
        skipSpy.mockRestore();
        skipAllSpy.mockRestore();
    });

    it("cancel test", () => {
        view.setPart(0);
        view.onChatMessage({
            uuid: crypto.randomUUID(),
            event: "test.cancelled",
            roomName: "student_1",
            questionIndex: 0,
            questionId: 1,
            practice: false,
            partId: 1,
            assignmentId: 1,
            note: "Vi afbryder her",
        });
        expect(view.onTestComplete).toHaveBeenCalledWith(true);
        expect(view.mediaRecorder.stop).toHaveBeenCalled();
    });

    it("complete test", () => {
        vi.spyOn(StudentTestView.prototype, "onPartComplete");
        view.setPart(2);
        view.onPartComplete();
        expect(view.onTestComplete).toHaveBeenCalled();
    });

    it("cancel test without media recorder", () => {
        view.setPart(0);
        view.mediaRecorder = null;
        view.onChatMessage({
            uuid: crypto.randomUUID(),
            event: "test.cancelled",
            roomName: "student_1",
            questionIndex: 0,
            questionId: 1,
            practice: false,
            partId: 1,
            assignmentId: 1,
            note: "Vi afbryder her",
        });
        expect(view.onTestComplete).toHaveBeenCalledWith(true);
    });

    it("show invalid question", async () => {
        view.setPart(0);
        const canShow = await view.showQuestion(false, 999);
        expect(canShow).toBe(false);
    });

    it("show question", () => {
        view.setPart(0);
        view.showQuestion(false, 0);
        const question = view.currentQuestion;
        expect(domElements.showQuestionChallenge).toHaveBeenCalledWith(
            question.challengeText,
            question.challengeSoundUrl,
            question.challengeImageUrl,
            expect.any(Object),
        );
        expect(view.send).toHaveBeenCalledWith({
            uuid: expect.any(String),
            student: expect.any(Object),
            event: "question.displayed",
            partIndex: view.currentPartIndex,
            partId: view.currentPart.id,
            questionIndex: view.currentQuestionIndex,
            questionId: view.currentQuestion.id,
            practice: false,
            displayedAt: 0,
            questionTitle: "1/3 (Individuel deltest)",
            assignmentId: 1,
        });
        expect(mediaRecorder.start).toHaveBeenCalled();
    });

    it("Trigger for first question reminder", () => {
        test.parts[0].timeout = 0;
        test.parts[0].questions[0].reminder = 5000;
        // Mock audio play
        view.domElements.playSound = vi.fn();
        view.setPart(0);
        view.showFirstQuestion(false);

        vi.advanceTimersByTime(5000);
        expect(view.domElements.playSound).toHaveBeenCalled();
    });

    it("question.feedback triggers teacherFeedback(correct)", () => {
        // Make sure part/question exists
        view.setPart(0);
        view.showQuestion(false, 0);

        view.onChatMessage({
            uuid: crypto.randomUUID(),
            event: "question.feedback",
            roomName: "student_1",
            assignmentId: 1,
            correct: true,
        });

        expect(view.teacherFeedback).toHaveBeenCalledWith(true);
    });

    it("teacherFeedback stores recorded audio from mediaRecorder.interval() and completes question", async () => {
        view.setPart(0);
        view.showQuestion(false, 0);

        // Ensure onQuestionComplete doesn't accidentally recurse into more logic for this test
        vi.spyOn(view, "onQuestionComplete").mockImplementation(() => {});

        await view.teacherFeedback(true);

        expect(mediaRecorder.interval).toHaveBeenCalled();
        expect(view.recordedAudio).toBe("BASE64_AUDIO");
        expect(view.onQuestionComplete).toHaveBeenCalled();
    });

    it("onPartComplete sends part.complete with duration and then calls super.onPartComplete()", () => {
        const superSpy = vi.spyOn(StudentTestView.prototype, "onPartComplete");
        view.setPart(0);
        const partIndex = view.currentPartIndex;
        const partId = view.currentPart.id;

        // Fake timestamps
        view.displayedAt = 100;
        document.timeline.currentTime = 175;

        view.onPartComplete();

        expect(view.send).toHaveBeenCalledWith({
            uuid: expect.any(String),
            student: expect.any(Object),
            event: "part.complete",
            partIndex: partIndex,
            partId: partId,
            duration: 75,
            assignmentId: 1,
        });

        expect(superSpy).toHaveBeenCalled();
    });

    it("onQuestionComplete sends question.answered including recordingBase64 and duration", () => {
        view.setPart(0);
        view.showQuestion(false, 0);

        // Simulate question timing
        view.displayedAt = 10;
        view.answeredAt = 55;
        view.recordedAudio = "BASE64_AUDIO";

        // Prevent it from actually trying to move forward in this test
        vi.spyOn(view, "showNextQuestion").mockReturnValue(true);

        view.onQuestionComplete();

        expect(view.send).toHaveBeenCalledWith({
            uuid: expect.any(String),
            student: expect.any(Object),
            event: "question.answered",
            message: "Elev har gennemført spørgsmål 1.1",
            choiceId: null,
            recordingBase64: "BASE64_AUDIO",
            partIndex: view.currentPartIndex,
            partId: view.currentPart.id,
            questionIndex: view.currentQuestionIndex,
            questionId: view.currentQuestion.id,
            practice: false,
            questionTitle: "1/3 (Individuel deltest)",
            displayedAt: 10,
            answeredAt: 55,
            duration: 45,
            assignmentId: 1,
        });
    });

    it("onQuestionComplete shows next question when available", () => {
        view.setPart(0);
        view.showQuestion(false, 0);

        // Force the 'next question exists' branch
        vi.spyOn(view, "showNextQuestion").mockReturnValue(true);
        vi.spyOn(view, "onPartComplete");

        view.displayedAt = 0;
        view.answeredAt = 10;

        view.onQuestionComplete();

        expect(view.showNextQuestion).toHaveBeenCalled();
        expect(view.onPartComplete).not.toHaveBeenCalled();
    });

    it("onQuestionComplete calls onPartComplete when no next question exists", async () => {
        view.setPart(0);
        view.showQuestion(false, 0);

        // Force the 'no more questions' branch
        vi.spyOn(view, "showNextQuestion").mockReturnValue(false);
        vi.spyOn(view, "onPartComplete").mockImplementation(() => {});

        view.displayedAt = 0;
        view.answeredAt = 10;

        await view.onQuestionComplete();

        expect(view.onPartComplete).toHaveBeenCalled();
    });

    it("onTestComplete stops mediaRecorder before calling super.onTestComplete()", async () => {
        // Spy on parent method to ensure it's called
        const superSpy = vi
            .spyOn(StudentTestView.prototype, "onTestComplete")
            .mockImplementation(() => {});

        await view.onTestComplete(false);

        expect(stopSpy).toHaveBeenCalled();
        expect(superSpy).toHaveBeenCalledWith(false);
    });

    it("parses websocket message event and forwards to onChatMessage", () => {
        const onChatMessageSpy = vi.spyOn(view, "onChatMessage");

        // Trigger the registered websocket listener
        const payload = { event: "ping", roomName: "student_1" };
        p2pListener({ detail: payload });

        expect(onChatMessageSpy).toHaveBeenCalledWith(payload);
    });

    it("should handle practice mode UI and flow correctly", async () => {
        view.setPart(0);
        // 1. Force isPracticing to true
        view.isPracticing = true;

        view.showQuestion(true, 1);

        expect(domElements.setStudentHeader).toHaveBeenCalledWith(
            expect.stringContaining("ph-pencil-line"),
        );

        // Setup for completion check
        view.displayedAt = 100;
        view.answeredAt = 200;

        vi.spyOn(view, "showFirstQuestion").mockImplementation(() => {});
        vi.spyOn(view, "showNextQuestion").mockReturnValue(false);

        await view.onQuestionComplete();

        // Assert: Correct practice message and redirect
        expect(view.send).toHaveBeenCalledWith(
            expect.objectContaining({
                message: expect.stringContaining("øve-spørgsmål"),
                practice: true,
            }),
        );
        expect(view.showFirstQuestion).toHaveBeenCalledWith(false);
    });

    it("should trigger automatic completion when question timeout is reached", () => {
        view.setPart(0);
        // Inject a specific timeout value
        test.parts[0].questions[0].timeout = 5000;
        test.parts[0].questions[0].instruction_sequence = null; // Ensure we hit the 'else' block

        const completeSpy = vi
            .spyOn(view, "onQuestionComplete")
            .mockImplementation(() => {});

        view.showQuestion(false, 0);

        // Fast-forward time
        vi.advanceTimersByTime(5000);

        expect(completeSpy).toHaveBeenCalledWith(expect.anything(), true);
        vi.useRealTimers();
    });

    it("should play reminder sound when reminder interval is reached", () => {
        // Mock audio element
        view.domElements.reminderSoundEl = {
            play: vi.fn(),
            currentTime: 10, // Start with non-zero to test reset
        };

        view.setPart(0);
        test.parts[0].questions[0].reminder = 3000;
        test.parts[0].questions[0].instruction_sequence = null;

        view.showQuestion(false, 0);

        vi.advanceTimersByTime(3000);

        expect(view.domElements.playSound).toHaveBeenCalled();
        vi.useRealTimers();
    });

    it("should wire up next button to complete question during instructions", () => {
        // 1. Ensure the question has an instruction sequence to enter the specific block
        const question = test.parts[0].questions[0];
        question.instruction_sequence = { instructions: [] };
        view.setPart(0);

        // 2. Capture the callback passed to the DOM element
        let capturedNextCallback;
        domElements.setNextButtonListener.mockImplementation((cb) => {
            capturedNextCallback = cb;
        });

        view.showQuestion(false, 0);

        // 3. Spy on the target method
        const completeSpy = vi
            .spyOn(view, "onQuestionComplete")
            .mockImplementation(() => {});

        // 4. Execute the captured callback and verify
        capturedNextCallback();
        expect(completeSpy).toHaveBeenCalledWith(question);
    });

    it("should wire up repeat button to repeat method during instructions", () => {
        test.parts[0].questions[0].instruction_sequence = { instructions: [] };
        view.setPart(0);

        // 1. Capture the repeat callback
        let capturedRepeatCallback;
        domElements.setRepeatButtonListener.mockImplementation((cb) => {
            capturedRepeatCallback = cb;
        });

        view.showQuestion(false, 0);

        // 2. Spy on the repeat method (inherited from StudentTestView)
        const repeatSpy = vi.spyOn(view, "repeat").mockImplementation(() => {});

        // 3. Execute and verify
        capturedRepeatCallback();
        expect(repeatSpy).toHaveBeenCalled();
    });

    it("Show instructions", () => {
        view.setPart(0);
        view.showQuestion(true, 0);
        expect(domElements.setStudentHeader).toHaveBeenCalledWith(
            '<i class="ph ph-ear"></i>',
        );
        expect(view.runInstructions).toHaveBeenCalledWith();
    });

    it("handles the 'question.changed' event", () => {
        // Arrange
        const newQuestionIndex = 1;
        const isPractice = false;
        view.setPart(0);
        // Act
        view.onChatMessage({
            uuid: crypto.randomUUID(),
            event: "question.changed",
            partIndex: 0,
            partId: 1,
            questionIndex: newQuestionIndex,
            questionId: 2,
            assignmentId: 1,
            practice: isPractice,
        });
        // Assert
        expect(view.showQuestion).toHaveBeenCalledWith(isPractice, newQuestionIndex);
    });

    it("handles 'question.changed' events that change part index", () => {
        // Arrange
        const newPartIndex = 1;
        const newQuestionIndex = 1;
        const isPractice = false;
        view.setPart(0);
        // Act
        view.onChatMessage({
            uuid: crypto.randomUUID(),
            event: "question.changed",
            partIndex: newPartIndex,
            partId: 1,
            questionIndex: newQuestionIndex,
            questionId: 2,
            assignmentId: 1,
            practice: isPractice,
        });
        // Assert
        expect(view.setPart).toHaveBeenCalledWith(newPartIndex);
        expect(view.showQuestion).toHaveBeenCalledWith(isPractice, newQuestionIndex);
    });
    it("passes 'audio.detected' and 'audio.quiet' events on to teacher's session", () => {
        for (const event of ["audio.detected", "audio.quiet"]) {
            // Act: pretend the audio detector dispatches an event
            view.audioDetector.dispatchEvent(new Event(event));
            // Assert that we pass the audio event on
            expect(view.onAudioEvent).toHaveBeenCalledWith(event);
            expect(view.send).toHaveBeenCalled();
        }
    });

    it("passes 'audio.silent' events on to teacher's session once instructions are completed", async () => {
        // Arrange: complete the instructions by showing the first question
        view.setPart(0);
        await view.showQuestion(true, 0); // first practice question
        // Act: pretend the audio detector dispatches an event
        view.audioDetector.dispatchEvent(new Event("audio.silent"));
        // Assert that we pass the audio event on
        expect(view.onAudioEvent).toHaveBeenCalledWith("audio.silent");
        expect(view.send).toHaveBeenCalled();
    });
});

describe("Individual Test - Timer and Reminder Cleanup", () => {
    let view;
    let student;
    let domElements;
    let mediaRecorder;
    let ws;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(global, "clearTimeout");

        const test = new Test(individualTestData);
        // Ensure the test data has values that trigger the timer logic
        test.parts[0].questions[0].timeout = 5000;
        test.parts[0].questions[0].reminder = 2000;
        test.parts[0].questions[0].instruction_sequence = null; // Ensure we hit the timer block

        student = new Student({ id: 1 });

        domElements = new IndividualTestDomElements();

        mediaRecorder = {
            start: vi.fn(),
            stop: vi.fn(),
        };

        ws = getWebSocket("class_123");

        view = new IndividualTestView(test, ws, 1, domElements, mediaRecorder, student);
        view.setPart(0);
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    it("should clear existing questionTimeoutId when showQuestion is called", () => {
        // 1. Manually set a "stray" timer ID
        const fakeTimerId = 123;
        view.questionTimeoutId = fakeTimerId;

        // 2. Trigger showQuestion (which has internal logic to clear existing timers)
        view.showQuestion(false, 0);

        // 3. Assert that the old timer was cleared before the new one was set
        expect(clearTimeout).toHaveBeenCalledWith(fakeTimerId);
        // Ensure the ID was reset to null (or replaced by a new timer ID)
        expect(view.questionTimeoutId).not.toBe(fakeTimerId);
    });

    it("should clear existing questionReminderId when showQuestion is called", () => {
        // 1. Manually set a "stray" reminder ID
        const fakeReminderId = 456;
        view.questionReminderId = fakeReminderId;

        // 2. Trigger showQuestion
        view.showQuestion(false, 0);

        // 3. Assert cleanup
        expect(clearTimeout).toHaveBeenCalledWith(fakeReminderId);
        expect(view.questionReminderId).not.toBe(fakeReminderId);
    });
});
