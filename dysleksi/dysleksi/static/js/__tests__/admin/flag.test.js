/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { initialize_flagging } from "../../admin/flag.js";

const mockDoc = `
    <script id="flag_url" type="application/json">"/flag/0/"</script>
    <div class="student-flag-link" data-response-pk="4"></div>
    <input type="hidden" name="csrfmiddlewaretoken" value="12345" />
`;

describe("Flagging", () => {
    let flag_link;
    let flag_complete;
    const createMockResponse = (data) =>
        Promise.resolve({
            json: () => Promise.resolve(data),
            status: 200,
            ok: true,
        });
    const createMockResponseFail = () => ({
        status: 500,
        ok: false,
    });
    beforeEach(() => {
        document.body.innerHTML = mockDoc;
        flag_link = document.querySelector(".student-flag-link");
        flag_complete = new Promise((resolve) => {
            flag_link.addEventListener("flag_resolved", () => {
                resolve();
            });
        });
    });

    it("flag", async () => {
        global.fetch = vi.fn();
        vi.mocked(global.fetch).mockResolvedValue(
            createMockResponse({ flagged: true }),
        );
        initialize_flagging();
        await flag_link.click();
        await flag_complete;
        expect(global.fetch).toHaveBeenCalledTimes(1);
        const form = new FormData();
        form.set("flagged", "true");
        expect(global.fetch).toHaveBeenCalledWith("/flag/4/", {
            body: form,
            headers: {
                "X-CSRFToken": "12345",
            },
            method: "POST",
        });

        flag_link = document.querySelector(".student-flag-link");
        expect(Array.from(flag_link.classList)).toContain("flagged");
    });

    it("unflag", async () => {
        flag_link.classList.add("flagged");
        global.fetch = vi.fn();
        vi.mocked(global.fetch).mockResolvedValue(
            createMockResponse({ flagged: false }),
        );
        initialize_flagging();
        await flag_link.click();
        await flag_complete;
        expect(global.fetch).toHaveBeenCalledTimes(1);
        const form = new FormData();
        form.set("flagged", "false");
        expect(global.fetch).toHaveBeenCalledWith("/flag/4/", {
            body: form,
            headers: {
                "X-CSRFToken": "12345",
            },
            method: "POST",
        });
        expect(Array.from(flag_link.classList)).not.toContain("flagged");
    });

    it("fail_status", async () => {
        global.fetch = vi.fn();
        vi.mocked(global.fetch).mockResolvedValue(createMockResponseFail());
        initialize_flagging();
        await flag_link.click();
        await flag_complete;
        expect(global.fetch).toHaveBeenCalledTimes(1);
        const form = new FormData();
        form.set("flagged", "true");
        expect(global.fetch).toHaveBeenCalledWith("/flag/4/", {
            body: form,
            headers: {
                "X-CSRFToken": "12345",
            },
            method: "POST",
        });
        expect(Array.from(flag_link.classList)).not.toContain("flagged");
    });

    it("fail_data", async () => {
        global.fetch = vi.fn();
        vi.mocked(global.fetch).mockResolvedValue(createMockResponse(null));
        initialize_flagging();
        await flag_link.click();
        await flag_complete;
        expect(global.fetch).toHaveBeenCalledTimes(1);
        const form = new FormData();
        form.set("flagged", "true");
        expect(global.fetch).toHaveBeenCalledWith("/flag/4/", {
            body: form,
            headers: {
                "X-CSRFToken": "12345",
            },
            method: "POST",
        });
        expect(Array.from(flag_link.classList)).not.toContain("flagged");
    });

    it("fail_data", async () => {
        global.fetch = vi.fn();
        vi.mocked(global.fetch).mockResolvedValue(
            createMockResponse({ flagged: null }),
        );
        initialize_flagging();
        await flag_link.click();
        await flag_complete;
        expect(global.fetch).toHaveBeenCalledTimes(1);
        const form = new FormData();
        form.set("flagged", "true");
        expect(global.fetch).toHaveBeenCalledWith("/flag/4/", {
            body: form,
            headers: {
                "X-CSRFToken": "12345",
            },
            method: "POST",
        });
        expect(Array.from(flag_link.classList)).not.toContain("flagged");
    });
});
