/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {IndividualTestView} from "../../screening/individual/student-individual-test.js";
import * as individualTestData from "./individualtest.json" with { type: "json" }
import { getWebSocket } from "../../ws";
import { IndividualTestDomElements } from "../../screening/dom.js";
import { Test } from "../../screening/model.js";



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
            <table id="summary-table"></table>
            <button id="end-summary"></button>
            <div id="question-title"></div>
            <div id="question-challenge"></div>
            <div id="choices"></div>
        `;

        global.domElements = new IndividualTestDomElements();
        spyAttributes(global.domElements);

        global.testSpy = (test) => {
            // Apply spying to a test instance
            spyAttributes(test, ["chatSocket", "domElements", "summary", "summaryText"]);
        }

        global.ws = getWebSocket("class_123");
        global.mediaRecorder = {
            start: vi.fn(),
            stop: vi.fn(),
        };

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
            question.challengeImageUrl
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

});
