/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { InstructionSequenceRunner } from "../../screening/instruction.js";

function createFakeAudioContext() {
    const startMock = vi.fn();
    const stopMock = vi.fn();
    const connectMock = vi.fn();
    const onendedMap = {};

    return {
        decodeAudioData: vi.fn(async (arrayBuffer) => ({})), // returns dummy AudioBuffer
        createBufferSource: vi.fn(() => ({
            start: startMock,
            stop: stopMock,
            connect: connectMock,
            set onended(cb) { onendedMap.cb = cb; },
            get onended() { return onendedMap.cb; },
        })),
        destination: {},
    };
}

describe("InstructionSequenceRunner", () => {
	let domElements;
	let runner;
	let fakeContext;
	
	beforeEach(() => {
		document.body.innerHTML = `
			<div id="el1"></div>
			<div id="el2"></div>
			<button id="btn1"></button>
			<input type="text" id="input1" />
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
            setMarker: vi.fn(),
            addText: vi.fn(),
            removeText: vi.fn(),
		};
		fakeContext = createFakeAudioContext();

		// use fake timers for sleep
		vi.useFakeTimers();

		global.fetch = vi.fn(async () => ({
		    arrayBuffer: async () => new ArrayBuffer(8), // dummy audio data
		}));
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});
	
	it("getEl returns the correct element", () => {
		runner = new InstructionSequenceRunner(null, [], domElements, fakeContext);
		const el = runner.getEl("el1");
		expect(el).not.toBeNull();
		expect(el.id).toBe("el1");
	});
	
	it("executeInstruction calls correct DOM method for each action", async () => {
		runner = new InstructionSequenceRunner(null, [], domElements, fakeContext);
	
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
	
    it("executeInstruction throws error on incorrect action", async () => {
        try {
            runner = new InstructionSequenceRunner(null, [], domElements, fakeContext);
            await runner.executeInstruction({action: "foobar", element: "el1"});
            vi.fail("Expected error to be thrown");
        } catch (e) {
            expect(e.message).toBe("Unknown action: foobar")
        }
    });
	
	it("run executes instructions with delays", async () => {
		const instrs = [
			{ action: "show", element: "el1", delayAfter: 0 },
			{ action: "hide", element: "el2", delayAfter: 2000 },
		];
	
		runner = new InstructionSequenceRunner(null, instrs, domElements, fakeContext);
	
		const runPromise = runner.run();
	
		await vi.runAllTimersAsync();
		await runPromise;
	
		expect(domElements.showElement).toHaveBeenCalledWith(document.getElementById("el1"));
		expect(domElements.hideElement).toHaveBeenCalledWith(document.getElementById("el2"));
	});
	

	it("executeInstruction with playSound calls playSound()", async () => {
		runner = new InstructionSequenceRunner([], domElements, fakeContext);
	
		const playSoundSpy = vi.spyOn(runner, "playSound").mockResolvedValue();
	
		await runner.executeInstruction({ action: "playSound", url: "/sound.mp3" });
	
		expect(playSoundSpy).toHaveBeenCalledWith("/sound.mp3");
	});

	it("skip() skips the current sleep", async () => {
		const instrs = [
			{ action: "show", element: "el1", delayAfter: 1000 },
			{ action: "hide", element: "el2", delayAfter: 1000 },
		];
	
		runner = new InstructionSequenceRunner(null, instrs, domElements, fakeContext);
	
		const runPromise = runner.run();
	
		// skip the first instruction's sleep immediately
		runner.skip();
	
		await vi.runAllTimersAsync();
		await runPromise;
	
		expect(domElements.showElement).toHaveBeenCalledWith(document.getElementById("el1"));
		expect(domElements.hideElement).toHaveBeenCalledWith(document.getElementById("el2"));
	});
	

	it("skipToEnd() skips all remaining delays", async () => {
		const instrs = [
			{ action: "show", element: "el1", delayAfter: 1000 },
			{ action: "hide", element: "el2", delayAfter: 2000 },
		];
	
		runner = new InstructionSequenceRunner(null, instrs, domElements, fakeContext);
	
		const runPromise = runner.run();
	
		runner.skipToEnd(); // skip delays instantly
	
		await runPromise;
	
		// Both actions executed
		expect(domElements.showElement).toHaveBeenCalled();
		expect(domElements.hideElement).toHaveBeenCalled();
	});

	it("sleep() sets _currentSkipResolver and resolves when called", async () => {
		runner = new InstructionSequenceRunner(null, [], domElements, fakeContext);
	
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
		runner = new InstructionSequenceRunner(null, [], domElements, fakeContext);
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
		runner = new InstructionSequenceRunner(null, [], domElements, fakeContext);
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
		runner = new InstructionSequenceRunner(null, [], domElements, fakeContext);
	
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
        runner = new InstructionSequenceRunner(null, [], domElements, fakeContext);
        const playSoundSpy = vi.spyOn(runner, "playSound");
        runner.executeInstruction({action: "setButtonSoundOnce", element: "btn1", url: "/sound.mp3",});
        expect(domElements.setButtonAudioCallback).toHaveBeenCalled();
        const call = domElements.setButtonAudioCallback.mock.calls[0];
        const assignedFunction = call[1];
        assignedFunction();
        expect(playSoundSpy).toHaveBeenCalledWith("/sound.mp3");
    });

    it("set audio on button to be played once (no url)", async () => {
        runner = new InstructionSequenceRunner(null, [], domElements, fakeContext);
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
        runner = new InstructionSequenceRunner(view, [], domElements, fakeContext);
        runner.executeInstruction({action: "setRepeatButtonDestination", element: "btn1", data: "3"});
        expect(view.setRepeatDestination).toHaveBeenCalledWith(3);
    });

    it("set element text", () => {
        runner = new InstructionSequenceRunner(null, [], domElements, fakeContext);
        runner.executeInstruction({action: "setText", element: "el1", data: "test"});
        expect(domElements.setText).toHaveBeenCalledWith(document.getElementById("el1"), "test");
    });

    it("executeInstruction with clickButton clicks the element", async () => {
        runner = new InstructionSequenceRunner(null, [], domElements, fakeContext);
    
        const btn = document.getElementById("btn1");
        const clickSpy = vi.spyOn(btn, "click");
    
        await runner.executeInstruction({ action: "clickButton", element: "btn1" });
    
        expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it("set marker in element text", () => {
        runner = new InstructionSequenceRunner(null, [], domElements, fakeContext);
        const element = document.getElementById("input1");
        element.value = "Test";
        runner.executeInstruction({action: "setMarker", element: "input1", data: "2"});
        expect(domElements.setMarker).toHaveBeenCalledWith(element, 2);
    });

    it("add text in element", () => {
        runner = new InstructionSequenceRunner(null, [], domElements, fakeContext);
        const element = document.getElementById("input1");
        element.value = "Test";
        element.focus();
        element.setSelectionRange(2, 2);
        runner.executeInstruction({action: "addText", element: "input1", data: "foobar"});
        expect(domElements.addText).toHaveBeenCalledWith(element, "foobar");
    });

    it("remove text in element", () => {
        runner = new InstructionSequenceRunner(null, [], domElements, fakeContext);
        const element = document.getElementById("input1");
        element.value = "Test";
        element.focus();
        element.setSelectionRange(2, 2);
        runner.executeInstruction({action: "removeText", element: "input1", data: "3"});
        expect(domElements.removeText).toHaveBeenCalledWith(element, 3);
    });


    it("playSound() successfully fetches, decodes, and plays audio", async () => {
        runner = new InstructionSequenceRunner(null, [], domElements, fakeContext);
        
        // We don't want to actually wait for the promise to resolve via onended 
        // manually in this test, so we trigger the mock onended after start.
        const audioPromise = runner.playSound("/test.mp3");
    
        // Check if fetch was called
        expect(global.fetch).toHaveBeenCalledWith("/test.mp3");
    
        // Give the async microtasks a chance to run so we can grab the source
        await vi.waitFor(() => {
            expect(fakeContext.createBufferSource).toHaveBeenCalled();
        });
    
        // Simulate the audio finishing
        const source = fakeContext.createBufferSource.mock.results[0].value;
        source.onended(); 
    
        await audioPromise;
        expect(source.start).toHaveBeenCalled();
        expect(source.connect).toHaveBeenCalledWith(fakeContext.destination);
    });
    
    it("playSound() stops audio immediately when skip() is called", async () => {
        runner = new InstructionSequenceRunner(null, [], domElements, fakeContext);
        
        const audioPromise = runner.playSound("/long-audio.mp3");
    
        // Wait for the source to be created and started
        await vi.waitFor(() => {
            expect(fakeContext.createBufferSource).toHaveBeenCalled();
        });
    
        const source = fakeContext.createBufferSource.mock.results[0].value;
        
        // Trigger the skip
        runner.skip();
    
        // Verify stop was called
        expect(source.stop).toHaveBeenCalled();
        
        // Simulate the browser's behavior: stop() eventually triggers onended
        source.onended();
        
        await audioPromise;
        expect(runner._currentSkipResolver).toBeNull();
    });
    
    it("playSound() cleans up _currentSkipResolver even if fetch fails", async () => {
        // Mock fetch to reject
        global.fetch.mockRejectedValueOnce(new Error("Network Error"));
        
        runner = new InstructionSequenceRunner(null, [], domElements, fakeContext);
    
        await expect(runner.playSound("/broken.mp3")).rejects.toThrow("Network Error");
    
        // Ensure we aren't leaving stale resolvers behind
        expect(runner._currentSkipResolver).toBeNull();
    });
    
    it("playSound() does not attempt to play if skipCurrent is already true", async () => {
        runner = new InstructionSequenceRunner(null, [], domElements, fakeContext);
        runner.skipCurrent = true;
    
        await runner.playSound("/any.mp3");
    
        expect(global.fetch).not.toHaveBeenCalled();
        expect(fakeContext.createBufferSource).not.toHaveBeenCalled();
    });

    it("playSound() prevents double stop if skip is spammed", async () => {
        runner = new InstructionSequenceRunner(null, [], domElements, fakeContext);
        
        const audioPromise = runner.playSound("/test.mp3");
    
        await vi.waitFor(() => expect(fakeContext.createBufferSource).toHaveBeenCalled());
        const source = fakeContext.createBufferSource.mock.results[0].value;
    
        // Trigger skip
        runner.skip(); 
        expect(source.stop).toHaveBeenCalledTimes(1);
    
        // Call skip again immediately (spamming the button)
        // The 'if (!resolved)' check should prevent a second stop() call
        runner.skip();
        expect(source.stop).toHaveBeenCalledTimes(1);
    
        // Finalize the promise
        source.onended();
        await audioPromise;
    });

});
