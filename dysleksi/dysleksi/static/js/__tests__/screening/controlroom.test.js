/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {EventTable, ActionButtons, TeacherView, NoteField, QuestionView} from "../../screening/controlroom.js";
import * as wsModule from "../../screening/utils.js"; 

vi.mock("../../screening/utils.js");

describe("TeacherView Test", () => {
  let socket;
  let table;
  let buttons;
  let note;
  let questionView;

  beforeEach(() => {
    document.body.innerHTML = `
        <div id="question-container">
        <h1 id="question-title"></h1>
        <div id="question-content"></div>
        </div>
        <table id="events"><tbody></tbody></table>
        <button id="btn1"></button>
        <button id="cancelled"></button>
        <textarea id="note"></textarea>
    `;
    table = new EventTable();
    buttons = new ActionButtons();
    note = new NoteField();
    questionView = new QuestionView();

    socket = {
      addEventListener: vi.fn(),
      send: vi.fn(),
    };

    vi.spyOn(wsModule, "extractQuestions").mockReturnValue([
        {"questionId":1, "partId":1, "partName":"Test part 1", "challengeImageUrl": "/challenge.png"},
        {"questionId":2, "partId":1, "partName":"Test part 1", "challengeText": "Råb så højt du kan"}
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes socket and button listeners", () => {
    const wsGetter = vi.fn().mockReturnValue(socket);

    new TeacherView("room1", ["test1"], 1, wsGetter, table, buttons);

    expect(wsGetter).toHaveBeenCalledWith("room1");
    expect(socket.addEventListener).toHaveBeenCalledWith(
      "message",
      expect.any(Function)
    );
  });

  it("enables buttons on question.displayed", () => {
    const wsGetter = vi.fn().mockReturnValue(socket);
    const view = new TeacherView("room1", ["test1"], 1, wsGetter, table, buttons);

    // get the message handler registered on the socket
    const handler = socket.addEventListener.mock.calls.find(c => c[0] === "message")[1];

    // trigger a question.displayed event
    handler({
      data: JSON.stringify({
        event: "question.displayed",
        questionIndex: 0,
        questionTitle: "Q1",
        displayedAt: "10:00"
      }),
    });

    const btn = document.querySelector("button");
    expect(btn.classList.contains("disabled")).toBe(false);
  });


  it("show question on question.displayed", () => {
    const wsGetter = vi.fn().mockReturnValue(socket);
    const view = new TeacherView(
        "room1", ["test1"], 1, wsGetter, table, buttons, questionView
    );

    questionView.show();
    expect(questionView.containerElement.classList.contains("d-none")).toBe(false)

    // get the message handler registered on the socket
    const handler = socket.addEventListener.mock.calls.find(c => c[0] === "message")[1];

    // trigger a question.displayed event
    handler({
        data: JSON.stringify({
            event: "question.displayed",
            questionIndex: 0,
        }),
    });

    expect(questionView.titleElement.textContent).toBe("1/2 (Test part 1)");
    expect(questionView.contentElement.firstElementChild.attributes.getNamedItem("src").value).toBe("/challenge.png");

    handler({
        data: JSON.stringify({
            event: "question.displayed",
            questionIndex: 1,
        }),
    });

    expect(questionView.titleElement.textContent).toBe("2/2 (Test part 1)");
    expect(questionView.contentElement.firstElementChild.textContent).toBe("Råb så højt du kan");

  });

  it("sends message and disables buttons on click", () => {
    vi.spyOn(global.crypto, "randomUUID").mockReturnValue("UUID123");
    const wsGetter = vi.fn().mockReturnValue(socket);
    const view = new TeacherView(
        "room1",
        [{"id":1,"name":"part1","questions":[{"questionId":1,"partId":1},{"questionId":2,"partId":1}]}],
        1, wsGetter, table, buttons, note
    );

    // simulate displayed event to set testIndex
    view.questionIndex = 0;
    view.question = {"questionId":1,"partId":1};

    // Add data in note field
    note.noteEl.value = "Test note";

    // click the button
    buttons.buttons[0].click();

    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({
      uuid: "UUID123",
      event: "question.feedback",
      roomName: "room1",
      questionIndex: 0,
      questionId: 1,
      partId: 1,
      assignmentId: 1,
      correct: false,
      note: "Test note",
    }));

    expect(buttons.buttons[0].classList.contains("disabled")).toBe(true);
  });


    it("sends message and disables buttons on cancel click", () => {
        vi.spyOn(global.crypto, "randomUUID").mockReturnValue("UUID123");
        const wsGetter = vi.fn().mockReturnValue(socket);
        const view = new TeacherView(
            "room1",
            [{"id":1,"name":"part1","questions":[{"questionId":1,"partId":1},{"questionId":2,"partId":1}]}],
            1, wsGetter, table, buttons, note
        );

        // simulate displayed event to set testIndex
        view.questionIndex = 0;
        view.question = {"questionId":1,"partId":1};

        // Add data in note field
        note.noteEl.value = "Test note";

        const expectedContent = JSON.stringify({
            uuid: "UUID123",
            event: "test.cancelled",
            roomName: "room1",
            questionIndex: 0,
            questionId: 1,
            partId: 1,
            assignmentId: 1,
            note: "Test note",
        });

        global.confirm = vi.fn().mockReturnValue(false);
        buttons.buttons[1].click();
        expect(socket.send).not.toHaveBeenCalledWith(expectedContent);
        expect(buttons.buttons[0].classList.contains("disabled")).toBe(false);

        global.confirm = vi.fn().mockReturnValue(true);
        buttons.buttons[1].click();
        expect(socket.send).toHaveBeenCalledWith(expectedContent);
        expect(buttons.buttons[0].classList.contains("disabled")).toBe(true);
    });
});
