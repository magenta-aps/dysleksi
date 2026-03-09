/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {startSession, refreshSession} from "../screening/utils";
import * as wsModule from "../ws.js";
import {getWebSocket} from "../ws.js";
import { calculateStudentProgress } from '../screening/utils';
import { preventDoubleTapZoom } from '../screening/utils';
import { getCursorIndex } from '../screening/utils';

// Mock getWebSocket
vi.mock("../ws.js", () => ({
    getWebSocket: vi.fn(),
}));
// Mock getWebSocket
const sockets = {};
vi.spyOn(wsModule, "getWebSocket").mockImplementation((roomName) => {
    if (sockets[roomName]) return sockets[roomName];
    const listeners = {};

    const socket = {
        send: vi.fn((data) => {}),
        addEventListener: vi.fn((event, cb, options) => {
            listeners[event] = { cb, options };
        }),
        __trigger(event, payload) {
            listeners[event]?.cb(payload);
        },
        readyState: WebSocket.OPEN,
    };

    sockets[roomName] = socket;
    return socket;
});

describe('test startSession', () => {

    it('should send session.start event', () => {
        vi.spyOn(global.crypto, "randomUUID").mockReturnValue("UUID123");
        const roomName = "room-1";
        const chatSocket = startSession(roomName);
        expect(chatSocket.addEventListener).toHaveBeenCalled();

        chatSocket.__trigger("open");
        expect(chatSocket.send).toHaveBeenCalledWith(JSON.stringify({
            uuid: "UUID123",
            event: "session.start",
            roomUrl: "/",
        }));

    });


    it('should refresh session', () => {
        vi.spyOn(global.crypto, "randomUUID").mockReturnValue("UUID123");

        const roomName = "room-1";
        let chatSocket = startSession(roomName);
        expect(chatSocket.addEventListener).toHaveBeenCalled();

        chatSocket.__trigger(
            "message",
            {"data": JSON.stringify({"event": "student.ready"})}
        );
        expect(chatSocket.send).toHaveBeenCalled();
        expect(chatSocket.send).toHaveBeenCalledWith(JSON.stringify({
            uuid: "UUID123",
            event: "session.in_progress",
            roomUrl: "/",
        }));

    });

    it('should not refresh session is student is not ready', () => {
        vi.spyOn(global.crypto, "randomUUID").mockReturnValue("UUID123");

        const roomName = "room-3";
        let chatSocket = startSession(roomName);
        expect(chatSocket.addEventListener).toHaveBeenCalled();

        chatSocket.__trigger(
            "message",
            {"data": JSON.stringify({"event": "student.sleeping"})}
        );
        expect(chatSocket.send).not.toHaveBeenCalled();

    });

    it('should not send session.in_progress if socket is not OPEN', () => {
        const roomName = "room-closed";
        const chatSocket = startSession(roomName);
        
        // Manually change the mock's readyState to CLOSED (or any value != 1)
        chatSocket.readyState = WebSocket.CLOSED; 
        
        // Clear call history from the startSession call if any
        chatSocket.send.mockClear();
    
        // Trigger the refresh
        refreshSession(roomName);
    
        // Verify send was never called
        expect(chatSocket.send).not.toHaveBeenCalled();
    });

});

describe('wake lock utils', () => {
    let mockWakeLockSentinel;

    beforeEach(() => {
        mockWakeLockSentinel = {
            release: vi.fn(),           // sync now
            addEventListener: vi.fn(),
        };

        global.navigator.wakeLock = {
            request: vi.fn().mockResolvedValue(mockWakeLockSentinel),
        };

        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});

        vi.resetModules(); // important: reset module to clear module-level wakeLock
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should request a wake lock and log success', async () => {
        const { requestWakeLock } = await import('../screening/utils');

        await requestWakeLock();

        expect(global.navigator.wakeLock.request).toHaveBeenCalledWith('screen');
        expect(mockWakeLockSentinel.addEventListener).toHaveBeenCalledWith(
            'release',
            expect.any(Function)
        );
        expect(console.log).toHaveBeenCalledWith('Screen wake lock active');
    });

    it('should handle errors gracefully', async () => {
        const err = new Error('Fail');
        global.navigator.wakeLock.request.mockRejectedValue(err);

        const { requestWakeLock } = await import('../screening/utils');

        await requestWakeLock();

        expect(console.error).toHaveBeenCalledWith('Error, Fail');
    });

    it('should release the wake lock if it exists', async () => {
        const { requestWakeLock, releaseWakeLock } = await import('../screening/utils');

        await requestWakeLock();
        releaseWakeLock();

        expect(mockWakeLockSentinel.release).toHaveBeenCalled();

        // manually trigger release event to check console.log
        mockWakeLockSentinel.addEventListener.mock.calls.forEach(([event, callback]) => {
            if (event === 'release') callback();
        });

        expect(console.log).toHaveBeenCalledWith('Screen wake lock released');
    });

    it('should do nothing if wake lock is not set when releasing', async () => {
        const { releaseWakeLock } = await import('../screening/utils');

        expect(() => releaseWakeLock()).not.toThrow();
    });
});


describe('unlockAudioOnGesture', () => {
    let originalAudioContext;
    let lastAudioContextInstance;
    let utils;

    beforeEach(async () => {
        // Save original
        originalAudioContext = global.AudioContext;

        // Mock AudioContext class
        class MockAudioContext {
            constructor() {
                this.state = 'suspended';
                this.resume = vi.fn().mockResolvedValue();
                lastAudioContextInstance = this;
            }
        }
        global.AudioContext = MockAudioContext;

        // Reset module to clear module-level audioContext variable
        vi.resetModules();
        lastAudioContextInstance = null;
        utils = await import('../screening/utils');
    });

    afterEach(() => {
        global.AudioContext = originalAudioContext;
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('should create a new AudioContext if none exists', () => {
        const context = utils.unlockAudioOnGesture();
        expect(context).toBe(lastAudioContextInstance);
        expect(lastAudioContextInstance).toBeDefined();
        expect(lastAudioContextInstance.state).toBe('suspended');
    });

    it('should resume suspended AudioContext on first click', async () => {
        utils.unlockAudioOnGesture();

        const clickEvent = new Event('click');
        document.dispatchEvent(clickEvent);

        // Wait for promise resolution
        await Promise.resolve();
        expect(lastAudioContextInstance.resume).toHaveBeenCalled();
    });

    it('should remove click listener after first resume', async () => {
        const removeSpy = vi.spyOn(document, 'removeEventListener');

        utils.unlockAudioOnGesture();

        const clickEvent = new Event('click');
        document.dispatchEvent(clickEvent);

        await Promise.resolve();
        expect(removeSpy).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should return the same AudioContext on multiple calls', () => {
        const ctx1 = utils.unlockAudioOnGesture();
        const ctx2 = utils.unlockAudioOnGesture();
        expect(ctx1).toBe(ctx2);
    });

    it('should not add click listener if context is running', () => {
        utils.unlockAudioOnGesture();
        lastAudioContextInstance.state = 'running';
        const addSpy = vi.spyOn(document, 'addEventListener');

        utils.unlockAudioOnGesture();
        expect(addSpy).not.toHaveBeenCalled();
    });

    it('should use window.webkitAudioContext if window.AudioContext is undefined', async () => {
        // Remove AudioContext
        global.AudioContext = undefined;
    
        // Mock webkitAudioContext
        let lastWebkitInstance = null;
        class MockWebkitAudioContext {
            constructor() {
                this.state = 'suspended';
                this.resume = vi.fn().mockResolvedValue();
                lastWebkitInstance = this;
            }
        }
        global.webkitAudioContext = MockWebkitAudioContext;
    
        // Reset module to clear module-level audioContext variable
        vi.resetModules();
        const utilsWebkit = await import('../screening/utils');
    
        const context = utilsWebkit.unlockAudioOnGesture();
        expect(context).toBe(lastWebkitInstance);
        expect(lastWebkitInstance).toBeDefined();
    
        // Clean up
        delete global.webkitAudioContext;
    });


});


describe('calculateStudentProgress', () => {

    it('should return 0 if test is null or undefined', () => {
        expect(calculateStudentProgress(null, 0, 0)).toBe(0);
        expect(calculateStudentProgress(undefined, 0, 0)).toBe(0);
    });

    it('should return 0 if test.parts is empty', () => {
        const test = { parts: [] };
        expect(calculateStudentProgress(test, 0, 0)).toBe(0);
    });

    it('should return correct progress for a single part', () => {
        const test = { parts: [{ questions: [1,2,3,4,5] }] };
        expect(calculateStudentProgress(test, 0, 0)).toBeCloseTo(20); // 1/5
        expect(calculateStudentProgress(test, 0, 2)).toBeCloseTo(60); // 3/5
        expect(calculateStudentProgress(test, 0, 4)).toBeCloseTo(100); // 5/5
    });

    it('should return correct progress for multiple parts', () => {
        const test = { parts: [
            { questions: [1,2,3] },
            { questions: [1,2,3,4] },
            { questions: [1,2] },
        ]};

        // Part 0, question 1 (second question)
        expect(calculateStudentProgress(test, 0, 1)).toBeCloseTo((2/9)*100);

        // Part 1, question 2 (third question)
        // Done questions = part0 all (3) + part1 first 3 = 6, total = 3+4+2=9
        expect(calculateStudentProgress(test, 1, 2)).toBeCloseTo((6/9)*100);

        // Last part, last question
        expect(calculateStudentProgress(test, 2, 1)).toBeCloseTo(100);
    });

    it('should handle currentQuestionIndex larger than part questions', () => {
        const test = { parts: [{ questions: [1,2,3] }] };
        // currentQuestionIndex 5, only 3 questions in part
        expect(calculateStudentProgress(test, 0, 5)).toBeCloseTo(100);
    });

    it('should ignore future parts', () => {
        const test = { parts: [
            { questions: [1,2] },
            { questions: [1,2,3] },
            { questions: [1,2] },
        ]};
        // Current part = 1, currentQuestionIndex = 1
        // Done = part0 all (2) + current part first 2 = 4, total = 2+3+2=7
        expect(calculateStudentProgress(test, 1, 1)).toBeCloseTo((4/7)*100);
    });

    it('should handle parts with missing questions property', () => {
        const test = {
            parts: [
                { questions: [1, 2, 3] }, // 3 questions
                { questions: undefined },   // 0 questions (hits the fallback)
                { questions: [1, 2] }      // 2 questions
            ]
        };
    
        // Total questions should be 3 + 0 + 2 = 5
        
        // 1. Check progress at the very beginning
        // (1 question done / 5 total)
        expect(calculateStudentProgress(test, 0, 0)).toBeCloseTo(20);
    
        // 2. Check progress when current part is the one with undefined questions
        // Done = Part 0 (3) + Part 1 (0) = 3 total done
        expect(calculateStudentProgress(test, 1, 0)).toBeCloseTo(60);
    
        // 3. Check final progress
        expect(calculateStudentProgress(test, 2, 1)).toBeCloseTo(100);
    });

});


describe('getCursorIndex', () => {
    let input;

    beforeEach(() => {
        input = document.createElement('input');
        input.value = "Hello World";
        document.body.appendChild(input);

        // Mock getComputedStyle to avoid errors
        vi.spyOn(window, 'getComputedStyle').mockReturnValue({
            font: '16px Arial',
            letterSpacing: 'normal',
            whiteSpace: 'pre'
        });
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('should return 0 if input has no value', () => {
        input.value = "";
        const index = getCursorIndex(input, 50);
        expect(index).toBe(0);
    });

    it('should return 0 if tapX is 0 or negative', () => {
        const index = getCursorIndex(input, 0);
        expect(index).toBe(0);
    });

    it('should find the correct index using binary search simulation', () => {
        const originalCreateElement = document.createElement;
        vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
            const el = originalCreateElement.call(document, tagName);
            if (tagName === 'span') {
                vi.spyOn(el, 'getBoundingClientRect').mockImplementation(() => ({
                    // Simulate width = length of text * 10px
                    width: el.textContent.length * 10,
                    height: 20,
                    top: 0, left: 0, bottom: 0, right: 0
                }));
            }
            return el;
        });

        // "Hello" is 5 chars. If each char is 10px, 55px tap should land at index 5
        // (the gap between 'o' and ' ')
        const indexAtMid = getCursorIndex(input, 55);
        expect(indexAtMid).toBe(5);

        // A tap very far to the right should return the last index (text length)
        const indexAtEnd = getCursorIndex(input, 500);
        expect(indexAtEnd).toBe(11);
    });

    it('should clean up the temporary span from the DOM', () => {
        const spyRemove = vi.spyOn(document.body, 'removeChild');
        getCursorIndex(input, 20);
        
        // Ensure the span created for measurement was removed
        expect(spyRemove).toHaveBeenCalledWith(expect.any(HTMLSpanElement));
    });

    it('should handle white space correctly (pre style)', () => {
        input.value = "A B"; // Space at index 1
        
        const originalCreateElement = document.createElement;
        vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
            const el = originalCreateElement.call(document, tagName);
            if (tagName === 'span') {
                vi.spyOn(el, 'getBoundingClientRect').mockImplementation(() => ({
                    width: el.textContent.length * 10,
                }));
            }
            return el;
        });

        const index = getCursorIndex(input, 15); // middle of the space
        expect(index).toBe(1);
    });
});

describe('preventDoubleTapZoom', () => {
    let addEventListenerSpy;

    beforeEach(() => {
        document.body.innerHTML = '';
        addEventListenerSpy = vi.spyOn(document, 'addEventListener');

        preventDoubleTapZoom();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const triggerDoubleTap = (targetElement) => {
        const event1 = new CustomEvent('touchend', { bubbles: true, cancelable: true });
        const event2 = new CustomEvent('touchend', { bubbles: true, cancelable: true });
        
        // Define preventDefault mock on the second event
        event2.preventDefault = vi.fn();

        // Simulate the first tap
        targetElement.dispatchEvent(event1);
        
        // Simulate the second tap immediately (within 300ms)
        targetElement.dispatchEvent(event2);

        return event2;
    };

    it('should block zoom when double-tapping on a non-button element (e.g., a div)', () => {
        const div = document.createElement('div');
        document.body.appendChild(div);

        const secondEvent = triggerDoubleTap(div);

        expect(secondEvent.preventDefault).toHaveBeenCalled();
    });

    it('should NOT block zoom when double-tapping on a button', () => {
        const button = document.createElement('button');
        button.innerText = "Click Me";
        document.body.appendChild(button);

        const secondEvent = triggerDoubleTap(button);

        expect(secondEvent.preventDefault).not.toHaveBeenCalled();
    });

    it('should NOT block zoom when tapping an element inside a button (nested)', () => {
        const button = document.createElement('button');
        const span = document.createElement('span');
        button.appendChild(span);
        document.body.appendChild(button);

        const secondEvent = triggerDoubleTap(span);

        expect(secondEvent.preventDefault).not.toHaveBeenCalled();
    });

    it('should NOT block zoom when double-tapping on specialized button classes', () => {
        const customBtn = document.createElement('div');
        customBtn.className = 'letter-btn';
        document.body.appendChild(customBtn);

        const secondEvent = triggerDoubleTap(customBtn);

        expect(secondEvent.preventDefault).not.toHaveBeenCalled();
    });

    it('should NOT block zoom if the taps are more than 300ms apart', async () => {
        const div = document.createElement('div');
        document.body.appendChild(div);

        const event1 = new CustomEvent('touchend', { bubbles: true, cancelable: true });
        div.dispatchEvent(event1);

        // Wait 301ms
        await new Promise(r => setTimeout(r, 301));

        const event2 = new CustomEvent('touchend', { bubbles: true, cancelable: true });
        event2.preventDefault = vi.fn();
        div.dispatchEvent(event2);

        expect(event2.preventDefault).not.toHaveBeenCalled();
    });
});
