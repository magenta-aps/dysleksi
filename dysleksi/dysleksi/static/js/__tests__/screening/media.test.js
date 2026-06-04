/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, expectTypeOf, vi, beforeEach, afterEach } from "vitest";
import { AudioDetector, TestMediaRecorder } from "../../screening/media";
import { MockAudioContext } from "../mock_audio.js";

describe("TestMediaRecorder", () => {
    let recorder;
    let mockMediaRecorderInstance;
    const mockInterval = 1000;
    const mockStream = { getTracks: vi.fn() };

    beforeEach(() => {
        vi.restoreAllMocks();

        mockMediaRecorderInstance = {
            start: vi.fn(),
            stop: vi.fn(),
            addEventListener: vi.fn(),
            state: "inactive",
        };

        global.MediaRecorder = vi.fn().mockImplementation(function () {
            return mockMediaRecorderInstance;
        });

        global.FileReader = vi.fn().mockImplementation(function () {
            this.addEventListener = vi.fn();
            this.readAsDataURL = vi.fn(() => {
                this.result = "data:audio/webm;base64,mockdata";
                // Find the 'loadend' callback
                const loadendCall = this.addEventListener.mock.calls.find(
                    (c) => c[0] === "loadend",
                );
                if (loadendCall) loadendCall[1]();
            });
        });

        // 3. Mock navigator.mediaDevices using defineProperty for stability
        Object.defineProperty(global.navigator, "mediaDevices", {
            writable: true,
            configurable: true, // Crucial for deleting/modifying in tests
            value: {
                getUserMedia: vi.fn().mockResolvedValue(mockStream),
            },
        });

        recorder = new TestMediaRecorder(mockInterval);
    });

    it("should push data to recording and dispatch event when dataavailable occurs", async () => {
        const dispatchSpy = vi.spyOn(recorder, "dispatchEvent");

        // 1. Initialize the recorder
        await recorder.setup();

        // 2. Find the registered callback
        const dataCall = mockMediaRecorderInstance.addEventListener.mock.calls.find(
            (call) => call[0] === "dataavailable",
        );

        // Destructure safely
        const callback = dataCall[1];

        const mockBlob = { size: 1024, type: "audio/webm" };

        // 3. Trigger the callback with a mock event object
        callback({ data: mockBlob });

        // 4. Assertions
        expect(recorder.recording).toContain(mockBlob);
        expect(recorder.recording.length).toBe(1);
        expect(dispatchSpy).toHaveBeenCalledWith(expect.any(Event));

        const dispatchedEvent = dispatchSpy.mock.calls[0][0];
        expect(dispatchedEvent.type).toBe("recording.updated");
    });

    it("should initialize with empty recording and interval", () => {
        expect(recorder.recording).toEqual([]);
        expect(recorder.recordingUpdateInterval).toBe(mockInterval);
    });

    it("should resolve setup when getUserMedia is successful", async () => {
        await expect(recorder.setup()).resolves.toBeUndefined();
    });

    it("should reject if getUserMedia is not supported", async () => {
        // Instead of delete, overwrite with undefined
        Object.defineProperty(global.navigator, "mediaDevices", {
            configurable: true,
            value: undefined,
        });

        await expect(recorder.setup()).rejects.toBe("getUserMedia not supported");
    });

    it("should reject if getUserMedia fails", async () => {
        navigator.mediaDevices.getUserMedia.mockRejectedValue(
            new Error("Permission denied"),
        );
        await expect(recorder.setup()).rejects.toThrow("Permission denied");
    });

    it("should call mediaRecorder.start only if inactive", async () => {
        await recorder.setup();
        mockMediaRecorderInstance.state = "inactive";
        recorder.start();
        expect(mockMediaRecorderInstance.start).toHaveBeenCalledWith(mockInterval);
    });

    it("should call mediaRecorder.stop", async () => {
        await recorder.setup();
        recorder.stop();
        expect(mockMediaRecorderInstance.stop).toHaveBeenCalled();
    });

    it("should call start directly in interval if not recording", async () => {
        await recorder.setup();
        mockMediaRecorderInstance.state = "inactive";

        // Use a small timeout to let the sync part of the promise run
        recorder.interval();

        expect(mockMediaRecorderInstance.start).toHaveBeenCalled();
    });

    it("should resolve with base64 data and reset recording when in recording state", async () => {
        await recorder.setup();

        // 1. Force the mock to update its state when stop/start are called
        mockMediaRecorderInstance.stop.mockImplementation(() => {
            mockMediaRecorderInstance.state = "inactive";
        });
        mockMediaRecorderInstance.start.mockImplementation(() => {
            mockMediaRecorderInstance.state = "recording";
        });

        // 2. Initial state
        mockMediaRecorderInstance.state = "recording";
        const mockBlob = { size: 10, type: "audio/webm" };
        recorder.recording = [mockBlob];

        // 3. Start the interval
        const intervalPromise = recorder.interval();

        // 4. Trigger the data flow
        // In media.js, stop() was just called, so state is now 'inactive'
        // Now we trigger the 'dataavailable' callback on the MediaRecorder
        const dataCall = mockMediaRecorderInstance.addEventListener.mock.calls.find(
            (call) => call[0] === "dataavailable",
        );
        dataCall[1]({ data: mockBlob });

        // 5. Wait for the file reading and promise resolution
        const result = await intervalPromise;

        // --- Assertions ---
        expect(mockMediaRecorderInstance.stop).toHaveBeenCalled();
        expect(mockMediaRecorderInstance.start).toHaveBeenCalled();
        expect(result).toBe("data:audio/webm;base64,mockdata");
        expect(recorder.recording.length).toBe(0);
    });

    it("should NOT call mediaRecorder.start if the state is NOT inactive", async () => {
        await recorder.setup();

        // Set state to something other than 'inactive'
        mockMediaRecorderInstance.state = "recording";

        recorder.start();

        // Assert that start was NOT called in this invocation
        // (Note: it might have been called during setup depending on your logic,
        // so we check that it wasn't called with the interval again here)
        expect(mockMediaRecorderInstance.start).not.toHaveBeenCalled();
    });
});

describe("AudioDetector", () => {
    beforeEach(() => {
        global.window = {
            AudioContext: MockAudioContext,
        };
        global.document.timeline = {
            currentTime: 0,
        };
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const getInstance = (mockData = null) => {
        const stream = vi.fn();
        const instance = new AudioDetector(stream);
        if (mockData !== null) {
            instance.getBins = () => {
                return mockData;
            };
        }
        return instance;
    };

    it("initializes correctly", () => {
        const instance = getInstance();
        expect(instance.detectionLevelThreshold).toBe(0.25);
        expect(instance.debounceTime).toBe(2500.0);
        expect(instance.state).toBeNull();
        expect(instance.lastEventAt).toBeNull();
        expect(instance.analyser).not.toBeNull();
    });

    it("detects audio", () => {
        const onDetected = vi.fn();
        const instance = getInstance([256.0]);
        instance.addEventListener("audio.detected", onDetected);
        instance.run();
        expect(onDetected).toHaveBeenCalled();
    });

    it("detects quietness", () => {
        const onQuiet = vi.fn();
        const instance = getInstance([150.0]);
        instance.addEventListener("audio.quiet", onQuiet);
        instance.run();
        expect(onQuiet).toHaveBeenCalled();
    });

    it("detects silence", () => {
        const onSilence = vi.fn();
        const instance = getInstance([128.0]);
        instance.addEventListener("audio.silent", onSilence);
        instance.run();
        vi.advanceTimersByTime(2 * 60000.0 + 500); // Silence must last at least 2 mins
        expect(onSilence).toHaveBeenCalled();
    });

    it("only dispatches events if state has changed", () => {
        const onFoo = vi.fn();
        const instance = getInstance();
        instance.addEventListener("foo", onFoo);
        instance.dispatchDebounced("foo");
        instance.dispatchDebounced("foo");
        expect(onFoo).toHaveBeenCalledOnce();
    });

    it("only dispatches events if debounce period has passed", () => {
        const onFoo = vi.fn();
        const instance = getInstance();
        instance.addEventListener("foo", onFoo);
        // Dispatch initial event and then change state
        instance.dispatchDebounced("foo");
        instance.dispatchDebounced("bar");
        expect(onFoo).toHaveBeenCalledOnce();
        // Let time pass
        global.document.timeline.currentTime += 5000;
        instance.dispatchDebounced("foo");
        expect(onFoo).toHaveBeenCalledOnce();
    });

    it("calls the underlying audio analyser", () => {
        const instance = new AudioDetector(vi.fn());
        const bins = instance.getBins();
        expectTypeOf(bins).toEqualTypeOf(Uint8Array);
    });
});
