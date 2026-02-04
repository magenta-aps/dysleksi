/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {EventTable, ActionButtons, TeacherView, NoteField} from "../../screening/controlroom.js";
import * as wsModule from "../../screening/utils.js"; 

vi.mock("../../screening/utils.js");

describe("TeacherView Test", () => {
  let socket;
  let table;
  let buttons;
  let note;

  beforeEach(() => {
    document.body.innerHTML = `<table id="events"><tbody></tbody></table>
                               <button id="btn1"></button><textarea id="note"></textarea>`;
    table = new EventTable();
    buttons = new ActionButtons();
    note = new NoteField();

    socket = {
      addEventListener: vi.fn(),
      send: vi.fn(),
    };

    vi.spyOn(wsModule, "extractQuestions").mockReturnValue([{"questionId":1, "partId":1},{"questionId":2, "partId":1}]);
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
});
