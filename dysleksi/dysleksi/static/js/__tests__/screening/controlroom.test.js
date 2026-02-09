/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {EventTable, ActionButtons, TeacherView, NoteField, QuestionView} from "../../screening/controlroom.js";
import * as groupTestData from './grouptest.json' with { type: 'json' }
import * as individualTestData from './individualtest.json' with { type: 'json' }
import {Test} from "../../screening/model";

vi.mock("../../screening/utils.js");

describe("TeacherView Test", () => {
    let socket;
    let table;
    let buttons;
    let note;
    let questionView;
    const groupTest = new Test(groupTestData);
    const individualTest = new Test(individualTestData);
    let view;
    let wsGetter;

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
                <textarea id="note"></textarea>
        `;
        table = new EventTable();
        buttons = new ActionButtons();
        note = new NoteField();
        questionView = new QuestionView();
    });

    afterEach(() => {
        vi.restoreAllMocks();
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


    it("show question on question.displayed", () => {
        view = new TeacherView("room1", groupTest, 1, wsGetter, table, buttons, note, questionView);

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

        expect(questionView.titleElement.textContent).toBe("1/5 (Wordreading 2A (dummy))");
        expect(
            questionView.contentElement.getElementsByTagName("img").item(0).attributes.getNamedItem("src").value
        ).toBe("/media/wordreading_2_dummy/dog.png");

        handler({
            data: JSON.stringify({
                event: "question.displayed",
                partIndex: 0,
                questionIndex: 1,
            }),
        });

        expect(questionView.titleElement.textContent).toBe("2/5 (Wordreading 2A (dummy))");
        expect(
            questionView.contentElement.getElementsByTagName("img").item(0).attributes.getNamedItem("src").value
        ).toBe("/media/wordreading_2_dummy/bike.jpeg");
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
});
