/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { initEditNote } from "../../admin/edit-note.js";

const mockDoc = `
    <form data-edit-url="mock-edit-url">
        <input type="hidden" name="csrfmiddlewaretoken" value="12345" />
        <input type="text" class="note" data-pk="-1" value="foo" />
    </form>
`;

describe("EditNote", () => {
    const createMockResponse = () =>
        Promise.resolve({
            status: 200,
            ok: true,
        });

    beforeEach(() => {
        global.fetch = vi.fn();
        vi.mocked(global.fetch).mockResolvedValue(createMockResponse());

        document.body.innerHTML = mockDoc;
        initEditNote();
    });

    it("posts to server on 'change' events", () => {
        // Arrange and act
        const noteField = document.querySelector("input.note");
        noteField.value = "bar";
        noteField.dispatchEvent(new Event("change"));
        // Assert
        const expectedFormData = new FormData();
        expectedFormData.set("pk", "-1");
        expectedFormData.set("note", "bar");
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch).toHaveBeenCalledWith("mock-edit-url", {
            body: expectedFormData,
            headers: { "X-CSRFToken": "12345" },
            method: "POST",
        });
    });
});
