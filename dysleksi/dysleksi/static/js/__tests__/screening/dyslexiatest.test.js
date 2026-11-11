/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DyslexiaTestView } from "../../screening/dyslexia/student-dyslexia-test.js";
import { GroupTestDomElements } from "../../screening/dom.js";
import { Student, Test } from "../../screening/model.js";
import * as utils from "../../screening/utils.js";
import { AudioDetector } from "../../screening/media.js";
import { MockAudioContext } from "../mock_audio.js";

const mockP2P = {
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    reconnect: vi.fn(),
    messageQueue: [],
};

vi.mock("../../webRTC.js", () => ({
    WebRTCPeer: vi.fn().mockImplementation(function () {
        this.studentSetup = vi.fn().mockReturnValue(mockP2P);
        this.close = vi.fn();
    }),
}));

global.WebSocket = class {
    constructor() {
        this.send = vi.fn();
        this.close = vi.fn();
        this.addEventListener = vi.fn();
    }
};

global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
};

const DOM_HTML = `
    <div id="fade-overlay"></div>
    <div id="pause-overlay"></div>
    <div id="mic-lost-overlay"><button id="restore-mic"></button></div>
    <div class="debug-buttons"><div id="skip-to-part"></div></div>
    <div id="test-intro"></div>
    <h1 id="student-header" class="student-header"></h1>
    <div id="instructions-sound"></div>
    <div id="question-challenge"></div>
    <div id="choices"></div>
    <div id="multiple-choice-match-container">
        <div id="choices-left"></div>
        <div id="choices-right"></div>
    </div>
    <button id="next"></button>
    <button id="repeat"></button>
    <div id="test-container"></div>
    <div id="testpart-outro"></div>
    <h2 id="testpart-outro-text"></h2>
    <img id="testpart-outro-image">
    <button id="end-testpart-outro"></button>
    <div id="test-summary">
        <div id="summary-container"></div>
        <div id="summary-scroll-controls">
            <div id="scroll-summary-up"></div>
            <div id="scroll-summary-down"></div>
        </div>
        <button id="end-summary"></button>
        <div id="test-finished-row"><button id="summary-log-out"></button></div>
    </div>
`;

const question = (id, data) => ({
    id: id,
    possible_answers: [],
    existing_answers: {},
    instruction_sequence: null,
    ...data,
});

const answer = (id, text, correctness = "correct") => ({
    id: id,
    resource_name: text,
    resource_text: text,
    correctness: correctness,
});

const TEST_DATA = {
    id: 1,
    name: "Dysleksitest (voksen)",
    test_type: "dyslexia",
    parts: [
        {
            id: 1,
            name: "Apeqqutit inersimasunut",
            name_da: "Spørgeskema (voksne)",
            practice: [],
            completed_by: [],
            questions: [
                question(11, {
                    question_type: "multiple_choice",
                    challenge_text: "Ilaannikkut?",
                    is_questionnaire: true,
                    possible_answers: [
                        answer(1, "Ilaannikkut"),
                        { ...answer(2, "Tamatigut"), locked: true },
                    ],
                }),
                question(12, {
                    question_type: "multiple_choice",
                    challenge_text: "nuka",
                    possible_answers: [answer(3, "Aap"), answer(4, "Naamik", "wrong")],
                }),
            ],
        },
        {
            id: 2,
            name: "Oqaasiusanik nipituumik atuarneq",
            name_da: "Læs nonord højt",
            practice: [question(20, { question_type: "no_input_required" })],
            completed_by: [],
            questions: [
                question(21, { question_type: "no_input_required" }),
                question(22, { question_type: "no_input_required" }),
            ],
        },
    ],
};

describe("DyslexiaTestView", () => {
    let view;
    let mediaRecorder;
    let receive;

    const sent = (event) =>
        mockP2P.send.mock.calls.map(([data]) => data).filter((d) => d.event === event);

    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = DOM_HTML;
        document.timeline = { currentTime: 0 };
        vi.spyOn(Test.prototype, "preload").mockResolvedValue(new Map());
        vi.spyOn(utils, "unlockAudioOnGesture").mockReturnValue(
            Object.assign(new MockAudioContext(), {
                addEventListener: vi.fn(),
                suspend: vi.fn(),
            }),
        );
        vi.spyOn(AudioDetector.prototype, "run").mockImplementation(() => {});
        mockP2P.addEventListener.mockImplementation((name, callback) => {
            if (name === "message") {
                receive = (detail) => callback({ detail: detail });
            }
        });

        mediaRecorder = Object.assign(new EventTarget(), {
            start: vi.fn(),
            stop: vi.fn(),
            interval: vi.fn().mockResolvedValue("BASE64_AUDIO"),
        });
        view = new DyslexiaTestView(
            new Test(TEST_DATA),
            1,
            new GroupTestDomElements(),
            mediaRecorder,
            new Student({ id: 7 }),
        );
        view.setPart(0);
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it("shows the summaries without a voice-over", async () => {
        const playSound = vi.spyOn(view.domElements, "playSound");

        await view.startSummary();
        expect(document.getElementById("end-summary").style.visibility).toBe("visible");

        await view.onTestComplete();
        expect(document.getElementById("test-finished-row").style.display).toBe("flex");
        expect(playSound).not.toHaveBeenCalled();
    });

    it("only shows the questionnaire question, which the test leader answers", async () => {
        await view.showQuestion(false, 0);
        expect(document.getElementById("choices").children).toHaveLength(0);
        expect(document.getElementById("next").style.visibility).toBe("hidden");

        receive({ event: "question.feedback", correctness: "correct", choiceId: 1 });
        await vi.waitFor(() => expect(view.currentQuestionIndex).toBe(1));

        expect(sent("question.answered")[0]).toMatchObject({
            questionId: 11,
            choiceId: 1,
            correctness: "correct",
        });
    });

    it("only plays the sound after the instructions when told to", async () => {
        const question = view.currentPart.questions[1];
        question.instruction_sequence = { instructions: [] };
        question.continueWhenInstructionIsComplete = false;
        vi.spyOn(view, "runInstructions").mockImplementation(async (onCompleted) =>
            onCompleted(),
        );
        const playChallengeSound = vi
            .spyOn(view, "playChallengeSound")
            .mockImplementation(() => {});

        for (const play of [true, false]) {
            playChallengeSound.mockClear();
            question.playSoundWhenInstructionIsComplete = play;
            await view.showQuestion(false, 1);
            expect(playChallengeSound).toHaveBeenCalledTimes(play ? 1 : 0);
        }
    });

    it("tells whether a part without questions is completed", () => {
        const part = view.currentPart;
        part.questions = [];
        part.completedBy = [];
        expect(part.completedByStudent(view.student)).toBe(false);

        part.completedBy = [7];
        expect(part.completedByStudent(view.student)).toBe(true);
    });

    it("has debug buttons which start a part right away", () => {
        view.startIntro();
        const buttons = document.querySelectorAll("#skip-to-part button");
        expect([...buttons].map((b) => b.textContent)).toEqual([
            "DEBUG: 1. Spørgeskema (voksne)",
            "DEBUG: 2. Læs nonord højt",
        ]);

        buttons[1].click();

        expect(document.getElementById("test-intro").style.display).toBe("none");
        expect(document.querySelectorAll("#skip-to-part button")).toHaveLength(0);
        expect(view.currentPartIndex).toBe(1);
        expect(view.isPracticing).toBe(true);
    });

    it("only warns about a lost microphone where the student reads aloud", async () => {
        const overlay = () => document.getElementById("mic-lost-overlay").style.display;

        // The questionnaire does not need the microphone
        mediaRecorder.micLost = true;
        mediaRecorder.dispatchEvent(new Event("mic.lost"));
        expect(overlay()).toBe("");

        // The student reads aloud in the next part
        view.setPart(1);
        await view.showQuestion(false, 0);
        expect(overlay()).toBe("flex");
        expect(mediaRecorder.start).not.toHaveBeenCalled();
    });

    it("completes a part without questions once its practice is over", async () => {
        view.currentPart.questions = [];
        vi.spyOn(view, "onPartComplete").mockImplementation(() => {});

        expect(await view.showFirstQuestion(false)).toBe(false);
        expect(view.onPartComplete).toHaveBeenCalled();
    });

    it("lets the student move on from their own answers", async () => {
        await view.showQuestion(false, 1);
        const button = document.getElementById("choice-Aap");
        button.click();
        button.click();
        button.click();

        expect(document.getElementById("next").disabled).toBe(false);

        receive({ event: "question.feedback", correctness: "correct" });
        expect(sent("question.answered")).toHaveLength(0);
    });

    it("lets the student move on once they have read the word aloud", async () => {
        const next = document.getElementById("next");
        view.setPart(1);
        await view.showQuestion(true, 0);

        expect(sent("question.displayed")[0]).toMatchObject({
            questionId: 20,
            practice: true,
        });
        expect(mediaRecorder.start).toHaveBeenCalled();
        expect(next.style.visibility).toBe("hidden");

        view.audioDetector.dispatchEvent(new Event("audio.heard"));
        expect(next.style.visibility).toBe("visible");

        await view.onQuestionComplete();

        expect(sent("question.answered")[0]).toMatchObject({
            questionId: 20,
            recordingBase64: "BASE64_AUDIO",
            correctness: null,
            practice: true,
        });
        expect(view.currentQuestion.id).toBe(21);
        expect(next.style.visibility).toBe("hidden");
    });

    it("only lets the student move on to the next word", async () => {
        view.setPart(1);
        await view.showQuestion(false, 0);

        receive({ event: "question.feedback", correctness: "correct" });

        expect(sent("question.answered")).toHaveLength(0);
        expect(view.currentQuestion.id).toBe(21);

        await view.onQuestionComplete();
        expect(view.currentQuestion.id).toBe(22);
    });

    it("moves on from the instructions without an answer", async () => {
        view.setPart(1);
        const question = view.currentPart.practice[0];
        question.instruction_sequence = {
            instructions: [{ action: "show", element: "next" }],
        };
        question.continueWhenInstructionIsComplete = false;
        vi.spyOn(view, "runInstructions").mockImplementation(async (onCompleted) =>
            onCompleted(),
        );
        global.alert = vi.fn();
        await view.showQuestion(true, 0);
        expect(document.getElementById("next").disabled).toBe(false);

        view.audioDetector.dispatchEvent(new Event("audio.heard"));
        expect(document.getElementById("next").style.visibility).toBe("hidden");

        await view.onQuestionComplete();

        expect(view.currentQuestion.id).toBe(21);
        expect(global.alert).not.toHaveBeenCalled();
        expect(sent("question.answered")).toHaveLength(0);
    });

    it("listens for the word once the instructions are over", async () => {
        view.setPart(1);
        const question = view.currentPart.practice[0];
        question.instruction_sequence = { instructions: [] };
        question.continueWhenInstructionIsComplete = false;
        vi.spyOn(view, "runInstructions").mockImplementation(async (onCompleted) => {
            expect(mediaRecorder.start).not.toHaveBeenCalled();
            onCompleted();
        });
        await view.showQuestion(true, 0);
        expect(mediaRecorder.start).toHaveBeenCalled();

        view.audioDetector.dispatchEvent(new Event("audio.heard"));
        expect(document.getElementById("next").style.visibility).toBe("visible");
    });

    it("completes the part after the last word", async () => {
        view.setPart(1);
        await view.showQuestion(false, 1);
        const onPartComplete = vi.spyOn(view, "onPartComplete");
        vi.spyOn(view, "onTestComplete").mockImplementation(() => {});

        view.audioDetector.dispatchEvent(new Event("audio.heard"));
        await view.onQuestionComplete();

        expect(onPartComplete).toHaveBeenCalled();
        expect(sent("part.complete")).toHaveLength(1);

        view.audioDetector.dispatchEvent(new Event("audio.heard"));
        expect(document.getElementById("next").style.visibility).toBe("hidden");
    });

    it("follows the test leader to another question", async () => {
        view.setPart(1);
        const showQuestion = vi.spyOn(view, "showQuestion");

        receive({
            event: "question.changed",
            partIndex: 1,
            questionIndex: 1,
            practice: false,
        });

        expect(showQuestion).toHaveBeenCalledWith(false, 1);
    });

    it("stops the instructions when the test leader skips a part", () => {
        view.instructionRunner = { skipToEnd: vi.fn() };
        const onPartComplete = vi
            .spyOn(view, "onPartComplete")
            .mockImplementation(() => {});

        receive({ event: "question.changed", partIndex: 1, questionIndex: 0 });

        expect(view.instructionRunner.skipToEnd).toHaveBeenCalled();
        expect(onPartComplete).toHaveBeenCalled();
    });
});
