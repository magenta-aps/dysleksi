/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { InstructionSequenceRunner } from "../../screening/instruction.js";

describe("InstructionSequenceRunner", () => {
  let domElements;
  let runner;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="el1"></div>
      <div id="el2"></div>
      <button id="btn1"></button>
    `;

    domElements = {
      showElement: vi.fn(),
      hideElement: vi.fn(),
      fadeIn: vi.fn(),
      fadeOut: vi.fn(),
      highlight: vi.fn(),
      toggleButtonSelected: vi.fn(),
    };

    // use fake timers for sleep
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("getEl returns the correct element", () => {
    runner = new InstructionSequenceRunner([], domElements);
    const el = runner.getEl("el1");
    expect(el).not.toBeNull();
    expect(el.id).toBe("el1");
  });

  it("executeInstruction calls correct DOM method for each action", async () => {
    runner = new InstructionSequenceRunner([], domElements);

    const actions = [
      { action: "show", element: "el1" },
      { action: "hide", element: "el1" },
      { action: "fadeIn", element: "el1" },
      { action: "fadeOut", element: "el1" },
      { action: "highlight", element: "el1" },
      { action: "select", element: "btn1" },
    ];

    for (const instr of actions) {
      await runner.executeInstruction(instr);
    }

    expect(domElements.showElement).toHaveBeenCalledWith(document.getElementById("el1"));
    expect(domElements.hideElement).toHaveBeenCalledWith(document.getElementById("el1"));
    expect(domElements.fadeIn).toHaveBeenCalledWith(document.getElementById("el1"));
    expect(domElements.fadeOut).toHaveBeenCalledWith(document.getElementById("el1"));
    expect(domElements.highlight).toHaveBeenCalledWith(document.getElementById("el1"));
    expect(domElements.toggleButtonSelected).toHaveBeenCalledWith(document.getElementById("btn1"), true);
  });

  it("run executes instructions with delays", async () => {
    const instrs = [
      { action: "show", element: "el1", delayAfter: 0 },
      { action: "hide", element: "el2", delayAfter: 2000 },
    ];

    runner = new InstructionSequenceRunner(instrs, domElements);

    const runPromise = runner.run();

    await vi.runAllTimersAsync();
    await runPromise;

    expect(domElements.showElement).toHaveBeenCalledWith(document.getElementById("el1"));
    expect(domElements.hideElement).toHaveBeenCalledWith(document.getElementById("el2"));
  });

  it("playSound plays audio and resolves", async () => {
    const playMock = vi.fn();


    const AudioSpy = vi.fn(function(url) {
      this.url = url;
      this.play = playMock;
      this.addEventListener = (event, cb) => cb();
    });

    global.Audio = AudioSpy;

    runner = new InstructionSequenceRunner([], domElements);
    await runner.playSound("/sound.mp3");

    expect(playMock).toHaveBeenCalled();
    expect(global.Audio).toHaveBeenCalledWith("/sound.mp3");
  });

  it("executeInstruction with playSound calls playSound()", async () => {
    runner = new InstructionSequenceRunner([], domElements);

    const playSoundSpy = vi.spyOn(runner, "playSound").mockResolvedValue();

    await runner.executeInstruction({ action: "playSound", url: "/sound.mp3" });

    expect(playSoundSpy).toHaveBeenCalledWith("/sound.mp3");
  });


});
