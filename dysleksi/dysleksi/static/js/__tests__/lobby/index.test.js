/**
 * @vitest-environment jsdom
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

// 1. Mock the student module BEFORE importing the index
vi.mock('../../lobby/student.js', () => ({
  initStudentLobby: vi.fn(),
}));

// Import the function we mocked to track calls
import { initStudentLobby } from '../../lobby/student.js';

describe('Index Entry Point', () => {
  beforeEach(() => {
    // Clear the document and mocks between tests
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('should initialize the student lobby with data from the DOM', async () => {
    // 2. Setup the DOM element with data attributes
    document.body.innerHTML = `
      <div 
        data-individual-room-name="Alice-123" 
        data-class-room-name="Biology-101"
      ></div>
    `;

    // 3. Trigger the code execution by importing the file
    // We use a query string to cache-bust if running multiple times
    await import('../../lobby/index.js?t=' + Date.now());

    // 4. Assertions
    expect(initStudentLobby).toHaveBeenCalledWith({
      individualRoomName: 'Alice-123',
      classRoomName: 'Biology-101',
    });
  });

  it('should throw or fail gracefully if the element is missing', async () => {
    // No element in the DOM here
    
    // We expect this to throw an error because el.dataset will fail
    await expect(import('./index.js?err=' + Date.now()))
      .rejects.toThrow();
  });
});