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
            setButtonAudioCallback: vi.fn(),
            setText: vi.fn(),
		};
	
		// use fake timers for sleep
		vi.useFakeTimers();
	});
	
	afterEach(() => {
		vi.useRealTimers();
	});
	
	it("getEl returns the correct element", () => {
		runner = new InstructionSequenceRunner(null, [], domElements);
		const el = runner.getEl("el1");
		expect(el).not.toBeNull();
		expect(el.id).toBe("el1");
	});
	
	it("executeInstruction calls correct DOM method for each action", async () => {
		runner = new InstructionSequenceRunner(null, [], domElements);
	
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
	
		runner = new InstructionSequenceRunner(null, instrs, domElements);
	
		const runPromise = runner.run();
	
		await vi.runAllTimersAsync();
		await runPromise;
	
		expect(domElements.showElement).toHaveBeenCalledWith(document.getElementById("el1"));
		expect(domElements.hideElement).toHaveBeenCalledWith(document.getElementById("el2"));
	});
	
	it("playSound plays audio and resolves", async () => {
		const playMock = vi.fn();
	
	
		const audioMock = {
		    preload: "auto",
		    play: playMock,
		    pause: vi.fn(),
		    addEventListener: vi.fn((event, cb) => {
		        if (event === "ended") cb();
		    }),
		    removeEventListener: vi.fn(),
		    currentTime: 0,
		    duration: 10,
		    src: "",
		};
    
		const AudioSpy = vi.fn(function () {
		    return audioMock;
		});
	
		global.Audio = AudioSpy;
	
		runner = new InstructionSequenceRunner(null, [], domElements);
		await runner.playSound("/sound.mp3");
	
		expect(playMock).toHaveBeenCalled();
		expect(AudioSpy).toHaveBeenCalledTimes(1);
		expect(audioMock.src).toBe("/sound.mp3");
		expect(audioMock.pause).toHaveBeenCalled();
	});
	
	it("executeInstruction with playSound calls playSound()", async () => {
		runner = new InstructionSequenceRunner([], domElements);
	
		const playSoundSpy = vi.spyOn(runner, "playSound").mockResolvedValue();
	
		await runner.executeInstruction({ action: "playSound", url: "/sound.mp3" });
	
		expect(playSoundSpy).toHaveBeenCalledWith("/sound.mp3");
	});

	it("skip() skips the current sleep", async () => {
		const instrs = [
			{ action: "show", element: "el1", delayAfter: 1000 },
			{ action: "hide", element: "el2", delayAfter: 1000 },
		];
	
		runner = new InstructionSequenceRunner(null, instrs, domElements);
	
		const runPromise = runner.run();
	
		// skip the first instruction's sleep immediately
		runner.skip();
	
		await vi.runAllTimersAsync();
		await runPromise;
	
		expect(domElements.showElement).toHaveBeenCalledWith(document.getElementById("el1"));
		expect(domElements.hideElement).toHaveBeenCalledWith(document.getElementById("el2"));
	});
	
	it("skip() skips the current playSound", async () => {
		const playMock = vi.fn(() => Promise.resolve());
	
		const audioMock = {
		    preload: "auto",
		    play: playMock,
		    pause: vi.fn(),
		    addEventListener: vi.fn(),
		    removeEventListener: vi.fn(),
		    currentTime: 0,
		    duration: 10,
		    src: "",
		};
    
		const AudioSpy = vi.fn(function () {
		    return audioMock;
		});
	
		global.Audio = AudioSpy;
	
		runner = new InstructionSequenceRunner(
            null,
			[{ action: "playSound", url: "/sound.mp3" }],
			domElements
		);
	
		const runPromise = runner.run();
	
		// skip the currently playing sound immediately
		runner.skip();
	
		await runPromise;
	
		expect(audioMock.src).toBe("/sound.mp3");
		expect(playMock).toHaveBeenCalled();
		expect(AudioSpy).toHaveBeenCalledTimes(1);
		expect(audioMock.pause).toHaveBeenCalled();
		expect(audioMock.removeEventListener).toHaveBeenCalled();
	});

	it("skipToEnd() skips all remaining delays", async () => {
		const instrs = [
			{ action: "show", element: "el1", delayAfter: 1000 },
			{ action: "hide", element: "el2", delayAfter: 2000 },
		];
	
		runner = new InstructionSequenceRunner(null, instrs, domElements);
	
		const runPromise = runner.run();
	
		runner.skipToEnd(); // skip delays instantly
	
		await runPromise;
	
		// Both actions executed
		expect(domElements.showElement).toHaveBeenCalled();
		expect(domElements.hideElement).toHaveBeenCalled();
	});

	it("sleep() sets _currentSkipResolver and resolves when called", async () => {
		runner = new InstructionSequenceRunner(null, [], domElements);
	
		let resolved = false;
		const sleepPromise = runner.sleep(500).then(() => {
			resolved = true;
		});
	
		// _currentSkipResolver should be defined while sleeping
		expect(typeof runner._currentSkipResolver).toBe("function");
	
		// Call the resolver manually to skip
		runner._currentSkipResolver();
	
		// Wait a tick so promise settles
		await sleepPromise;
	
		// The promise should have resolved
		expect(resolved).toBe(true);
	
		// After resolution, _currentSkipResolver should be cleared
		expect(runner._currentSkipResolver).toBe(null);
	});

	it("sleep() returns immediately with Promise.resolve() if skipCurrent is true", async () => {
		runner = new InstructionSequenceRunner(null, [], domElements);
		runner.skipCurrent = true; // trigger the immediate return branch

		let resolved = false;
		await runner.sleep(100).then(() => {
			resolved = true;
		});
	
		// The promise should resolve immediately
		expect(resolved).toBe(true);
	
		// _currentSkipResolver should never be set
		expect(runner._currentSkipResolver).toBe(null);
	});


	it("playSound() returns immediately with Promise.resolve() if skipCurrent is true", async () => {
		runner = new InstructionSequenceRunner(null, [], domElements);
		runner.skipCurrent = true; // trigger the immediate return branch
	
		let resolved = false;
		await runner.playSound("/sound.mp3").then(() => {
			resolved = true;
		});
	
		// The promise should resolve immediately
		expect(resolved).toBe(true);
	
		// _currentSkipResolver should never be set
		expect(runner._currentSkipResolver).toBe(null);
	});


	it("skipToEnd() resolves the current instruction immediately if _currentSkipResolver is set", async () => {
		runner = new InstructionSequenceRunner(null, [], domElements);
	
		// Start a sleep so that _currentSkipResolver gets set
		const sleepPromise = runner.sleep(1000);
	
		// _currentSkipResolver should be defined while sleeping
		expect(typeof runner._currentSkipResolver).toBe("function");
	
		// Call skipToEnd(), which should call _currentSkipResolver internally
		runner.skipToEnd();
	
		await sleepPromise;
	
		// After resolution, _currentSkipResolver should be cleared
		expect(runner._currentSkipResolver).toBe(null);
	});

    it("set audio on button to be played once", async () => {
        runner = new InstructionSequenceRunner(null, [], domElements);
        const playSoundSpy = vi.spyOn(runner, "playSound");
        runner.executeInstruction({action: "setButtonSoundOnce", element: "btn1", url: "/sound.mp3",});
        expect(domElements.setButtonAudioCallback).toHaveBeenCalled();
        const call = domElements.setButtonAudioCallback.mock.calls[0];
        const assignedFunction = call[1];
        assignedFunction();
        expect(playSoundSpy).toHaveBeenCalledWith("/sound.mp3");
    });

    it("set audio on button to be played once (no url)", async () => {
        runner = new InstructionSequenceRunner(null, [], domElements);
        const playSoundSpy = vi.spyOn(runner, "playSound");
        runner.executeInstruction({action: "setButtonSoundOnce", element: "btn1", url: null,});
        expect(domElements.setButtonAudioCallback).toHaveBeenCalled();
        const call = domElements.setButtonAudioCallback.mock.calls[0];
        const assignedFunction = call[1];
        assignedFunction();
        expect(playSoundSpy).not.toHaveBeenCalled();
    });

    it("set repeatbutton destination", () => {
        const view = {
            "setRepeatDestination": vi.fn()
        };
        runner = new InstructionSequenceRunner(view, [], domElements);
        runner.executeInstruction({action: "setRepeatButtonDestination", element: "btn1", data: "3"});
        expect(view.setRepeatDestination).toHaveBeenCalledWith(3);
    });

    it("set element text", () => {
        runner = new InstructionSequenceRunner(null, [], domElements);
        runner.executeInstruction({action: "setText", element: "el1", data: "test"});
        expect(domElements.setText).toHaveBeenCalledWith(document.getElementById("el1"), "test");
    });
});
