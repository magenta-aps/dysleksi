/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {IndividualTestView} from "../../screening/individual/student-individual-test.js";
import * as individualTestData from "./individualtest.json" with { type: "json" }
import { getWebSocket } from "../../ws";
import { IndividualTestDomElements } from "../../screening/dom.js";
import { Test } from "../../screening/model.js";
import {StudentTestView} from "../../screening/student-test.js";
import {spyAttributes} from "../utils.js";
import * as utils from "../../screening/utils.js";

describe("IndividualTestFlow", () => {
    let originalWebSocket;
    let mockSend;

    beforeEach(() => {
        global.window = {
            location: { protocol: "https:", host: "example.com" }
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

        document.body.innerHTML = `
            <div id="audio-indicator" style="display: none"></div>
            <h1 id="student-header" class="student-header"></h1>
            <audio id="instructions-sound"></audio>
            <button id="end-summary"></button>
            <div id="question-challenge"></div>
            <div id="choices"></div>
        `;

        global.domElements = new IndividualTestDomElements();
        spyAttributes(global.domElements);

        global.testSpy = (test) => {
            // Apply spying to a test instance
            spyAttributes(test, ["chatSocket", "domElements", "summary"]);
        }

        global.ws = getWebSocket("class_123");
        global.mediaRecorder = {
            start: vi.fn(),
            stop: vi.fn(),
        };
        vi.spyOn(utils, "unlockAudioOnGesture").mockReturnValue({});


    });

    it("Test Structure loads", () => {
        // Test that the instance with subinstances is correctly created from json
        const test = new Test(individualTestData);
        expect(test.name).toBe("Individuel test");
        expect(test.parts.length).toBe(1);
        expect(test.parts[0].test).toBe(test);
        expect(test.parts[0].id).toBe(1);
        expect(test.parts[0].index).toBe(0);
        expect(test.parts[0].name).toBe("Individuel deltest");
        expect(test.parts[0].instructionsUrl).toBe(null);
        expect(test.parts[0].intro).toBe("Dette er en dummy test");
        expect(test.parts[0].timeout).toBe(60);
        expect(test.parts[0].partialScoreAfter).toBe(30);
        expect(test.parts[0].questions.length).toBe(3);
        expect(test.parts[0].questionIndex).toBe(0);
        expect(test.parts[0].currentQuestion).toBe(null);
    });


    it("cancel test", () => {
        const test = new Test(individualTestData);
        const view = new IndividualTestView(test, ws, "student_1", 1, domElements, mediaRecorder);
        testSpy(view);
        view.onChatMessage({
            uuid: crypto.randomUUID(),
            event: "test.cancelled",
            roomName: "student_1",
            questionIndex: 0,
            questionId: 1,
            partId: 1,
            assignmentId: 1,
            note: "Vi afbryder her",
        });
        expect(view.onTestComplete).toHaveBeenCalledWith(true);
    });

    it("show question", () => {
        const test = new Test(individualTestData);
        const view = new IndividualTestView(test, ws, "student_1", 1, domElements, mediaRecorder);
        testSpy(view);
        view.showPart(0);
        view.showQuestion(false, 0);
        const question = view.currentQuestion;
        expect(domElements.showQuestionChallenge).toHaveBeenCalledWith(
            question.challengeText,
            question.challengeSoundUrl,
            question.challengeImageUrl,
            expect.any(Object)
        );
        expect(view.send).toHaveBeenCalledWith({
            uuid: expect.any(String),
            event: "question.displayed",
            partIndex: view.currentPartIndex,
            partId: view.currentPart.id,
            questionIndex: view.currentQuestionIndex,
            questionId: view.currentQuestion.id,
            displayedAt: 0,
            questionTitle: "1/3 (Individuel deltest)",
            assignmentId: 1,
            roomName: "student_1",
        })
        expect(mediaRecorder.start).toHaveBeenCalled();

    });

    it("question.feedback triggers teacherFeedback(correct)", () => {
        const test = new Test(individualTestData);
        const view = new IndividualTestView(test, ws, "student_1", 1, domElements, mediaRecorder);
        testSpy(view);
    
        // Make sure part/question exists
        view.showPart(0);
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
        const test = new Test(individualTestData);
    
        mediaRecorder.interval = vi.fn().mockResolvedValue("BASE64_AUDIO");
    
        const view = new IndividualTestView(test, ws, "student_1", 1, domElements, mediaRecorder);
        testSpy(view);
    
        view.showPart(0);
        view.showQuestion(false, 0);
    
        // Ensure onQuestionComplete doesn't accidentally recurse into more logic for this test
        vi.spyOn(view, "onQuestionComplete").mockImplementation(() => {});
    
        await view.teacherFeedback(true);
    
        expect(mediaRecorder.interval).toHaveBeenCalled();
        expect(view.recordedAudio).toBe("BASE64_AUDIO");
        expect(view.onQuestionComplete).toHaveBeenCalled();
    });
    
    it("showPart shows instructions and shows first question", () => {
        const test = new Test(individualTestData);
        const view = new IndividualTestView(test, ws, "student_1", 1, domElements, mediaRecorder);
        testSpy(view);
    
        const ok = view.showPart(0);
    
        expect(ok).toBe(true);
    
        // It always shows the question challenge container first
        expect(domElements.showQuestionChallenge).toHaveBeenCalled();
    
        // When it can show, it shows instructions for the part
        expect(domElements.showInstructions).toHaveBeenCalledWith(
            view.currentPart.intro,
            view.currentPart.instructionsUrl
        );
    
        // It also immediately shows first question
        expect(view.showQuestion).toHaveBeenCalledWith(false, 0);
    });
    
    it("onPartComplete sends part.complete with duration and then calls super.onPartComplete()", () => {
        const test = new Test(individualTestData);
        const view = new IndividualTestView(test, ws, "student_1", 1, domElements, mediaRecorder);
        testSpy(view);
        const superSpy = vi.spyOn(StudentTestView.prototype, "onPartComplete");
        view.showPart(0);
    
        // Fake timestamps
        view.displayedAt = 100;
        document.timeline.currentTime = 175;
    
        view.onPartComplete();
    
        expect(view.send).toHaveBeenCalledWith({
            uuid: expect.any(String),
            event: "part.complete",
            partIndex: view.currentPartIndex,
            partId: view.currentPart.id,
            duration: 75,
            assignmentId: 1,
            roomName: "student_1",
        });
    
        expect(superSpy).toHaveBeenCalled();
    });
    
    it("onQuestionComplete sends question.answered including recordingBase64 and duration", () => {
        const test = new Test(individualTestData);
        const view = new IndividualTestView(test, ws, "student_1", 1, domElements, mediaRecorder);
        testSpy(view);
    
        view.showPart(0);
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
            event: "question.answered",
            message: "Elev har gennemført spørgsmål 1.1",
            choiceId: null,
            recordingBase64: "BASE64_AUDIO",
            partIndex: view.currentPartIndex,
            partId: view.currentPart.id,
            questionIndex: view.currentQuestionIndex,
            questionId: view.currentQuestion.id,
            questionTitle: "1/3 (Individuel deltest)",
            displayedAt: 10,
            answeredAt: 55,
            duration: 45,
            assignmentId: 1,
            roomName: "student_1",
        });
    });
    
    it("onQuestionComplete shows next question when available", () => {
        const test = new Test(individualTestData);
        const view = new IndividualTestView(test, ws, "student_1", 1, domElements, mediaRecorder);
        testSpy(view);
    
        view.showPart(0);
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
    
    it("onQuestionComplete calls onPartComplete when no next question exists", () => {
        const test = new Test(individualTestData);
        const view = new IndividualTestView(test, ws, "student_1", 1, domElements, mediaRecorder);
        testSpy(view);
    
        view.showPart(0);
        view.showQuestion(false, 0);
    
        // Force the 'no more questions' branch
        vi.spyOn(view, "showNextQuestion").mockReturnValue(false);
        vi.spyOn(view, "onPartComplete").mockImplementation(() => {});
    
        view.displayedAt = 0;
        view.answeredAt = 10;
    
        view.onQuestionComplete();
    
        expect(view.onPartComplete).toHaveBeenCalled();
    });
    
    it("onTestComplete stops mediaRecorder before calling super.onTestComplete()", async () => {
        const test = new Test(individualTestData);
    
        const stopSpy = vi.fn().mockResolvedValue(undefined);
        mediaRecorder.stop = stopSpy;
    
        const view = new IndividualTestView(test, ws, "student_1", 1, domElements, mediaRecorder);
        testSpy(view);
    
        // Spy on parent method to ensure it's called
        const superSpy = vi.spyOn(StudentTestView.prototype, "onTestComplete").mockImplementation(() => {});
    
        await view.onTestComplete(false);
    
        expect(stopSpy).toHaveBeenCalled();
        expect(superSpy).toHaveBeenCalledWith(false);
    });


    it("parses websocket message event and forwards to onChatMessage", () => {
        const test = new Test(individualTestData);
    
        // Create a chatSocket stub where we can capture the message listener
        let messageListener;
        const chatSocket = {
            addEventListener: vi.fn((eventName, cb) => {
                if (eventName === "message") messageListener = cb;
            }),
            send: vi.fn(),
        };
    
        const view = new IndividualTestView(
            test,
            chatSocket,
            "student_1",
            1,
            domElements,
            mediaRecorder
        );
    
        const onChatMessageSpy = vi.spyOn(view, "onChatMessage");
    
        // Trigger the registered websocket listener
        const payload = { event: "ping", roomName: "student_1" };
        messageListener({ data: JSON.stringify(payload) });
    
        expect(onChatMessageSpy).toHaveBeenCalledWith(payload);
    });


});
