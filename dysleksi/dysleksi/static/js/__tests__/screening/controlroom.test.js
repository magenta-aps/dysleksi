/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventTable, ActionButtons, TeacherView } from "../../screening/controlroom.js";
import * as wsModule from "../../screening/utils.js"; 

vi.mock("../../screening/utils.js");

describe("TeacherView Test", () => {
  let socket;
  let table;
  let buttons;

  beforeEach(() => {
    document.body.innerHTML = `<table id="events"><tbody></tbody></table>
                               <button id="btn1"></button>`;
    table = new EventTable();
    buttons = new ActionButtons();

    socket = {
      addEventListener: vi.fn(),
      send: vi.fn(),
    };

    vi.spyOn(wsModule, "extractQuestions").mockReturnValue(["Q1", "Q2"]);
  });

  afterEach(() => {
    vi.restoreAllMocks(); 
  });

  it("initializes socket and button listeners", () => {
    const wsGetter = vi.fn().mockReturnValue(socket);

    new TeacherView("room1", ["test1"], wsGetter, table, buttons);

    expect(wsGetter).toHaveBeenCalledWith("room1");
    expect(socket.addEventListener).toHaveBeenCalledWith(
      "message",
      expect.any(Function)
    );
  });

  it("enables buttons on test.displayed", () => {
    const wsGetter = vi.fn().mockReturnValue(socket);
    const view = new TeacherView("room1", ["test1"], wsGetter, table, buttons);

    // get the message handler registered on the socket
    const handler = socket.addEventListener.mock.calls.find(c => c[0] === "message")[1];

    // trigger a test.displayed event
    handler({
      data: JSON.stringify({
        event: "test.displayed",
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
    const view = new TeacherView("room1", ["test1"], wsGetter, table, buttons);

    // simulate displayed event to set testIndex
    view.testIndex = 0;

    // click the button
    buttons.buttons[0].click();

    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({
      uuid: "UUID123",
      event: "test.btn1",
      id: "room1",
      questionIndex: 0,
    }));

    expect(buttons.buttons[0].classList.contains("disabled")).toBe(true);
  });
});
