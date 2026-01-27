/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GroupTest } from '../test.js';
import * as grouptest from './grouptest.json' with { type: 'json' }
import {getWebSocket} from "../../ws";
import {GroupTestDomElements} from "../dom";

vi.mock("../dom")

describe('getWebSocket', () => {
    let originalWebSocket;
    let mockSend;

    beforeEach(() => {
        // Mock window.location correctly
        global.window = { location: { protocol: 'https:', host: 'example.com' } };

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

        global.GroupTestDomElements = vi.fn(
            class {
                constructor() { }
            }
        );
    });

    afterEach(() => {
        // Restore WebSocket
        global.WebSocket = originalWebSocket;
    });

    it('Test Structure loads', () => {
        // Test that the instance with subinstances is correctly created from json
        const ws = getWebSocket('class_123');
        const domElements = new GroupTestDomElements();
        const test = new GroupTest(grouptest, ws, 'class_123', domElements);
        expect(test.roomName).toBe("class_123");
        expect(test.name).toBe("Middle 2. grade");
        expect(test.partIndex).toBe(0);
        expect(test.parts.length).toBe(2);
        expect(test.parts[0].test).toBe(test);
        expect(test.parts[0].id).toBe(5);
        expect(test.parts[0].index).toBe(0);
        expect(test.parts[0].name).toBe('Wordreading 2A (dummy)');
        expect(test.parts[0].instructionsUrl).toBe(null);
        expect(test.parts[0].intro).toBe('Vælg det rigtige ord, der passer til billedet.');
        expect(test.parts[0].timeout).toBe(60);
        expect(test.parts[0].partialScoreAfter).toBe(30);
        expect(test.parts[0].questions.length).toBe(5);
        expect(test.parts[0].questionIndex).toBe(0);
        expect(test.parts[0].currentQuestion).toBe(null);
        expect(test.parts[0].domElements).toBe(domElements);
        expect(test.parts[0].practice.length).toBe(2);
        expect(test.parts[0].isPracticing).toBe(false);
    });

});
