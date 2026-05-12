/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { initialize_pagination } from "../../admin/pagination.js";

const mockDoc = `
    <div id="test-results-table">
        PAGE 1
    </div>
    <i id="pagination">{"current_page": 1, "current_first": 1, "current_last": 2, "total_count": 3, "page_size": 2, "last_page": 2}</i>
    <div data-pagination-details="pagination" data-pagination-page-param="page" data-pagination-target="test-results-table" data-pagination-content-param="only_table" class="col-2 d-flex align-items-center justify-content-md-end">
        <span class="paginator-text" data-format="\${first} - \${last} af \${total} \${foobar}">1 - 2 af 3</span>
        <div class="btn-group">
            <button class="paginate-left btn btn-borderless" disabled>
                <i class="ph ph-arrow-left m-0"></i>
            </button>
            <button class="paginate-right btn btn-borderless">
                <i class="ph ph-arrow-right m-0"></i>
            </button>
        </div>
    </div>
`;

describe("Pagination", () => {
    let paginate_left;
    let paginate_right;
    let target;
    let paginator_text;
    let pagination_complete;
    const createMockResponse = (data) =>
        Promise.resolve({
            text: () => Promise.resolve(data),
            status: 200,
            ok: true,
        });
    const createMockResponseFail = () => ({
        status: 500,
        ok: false,
    });
    beforeEach(() => {
        document.body.innerHTML = mockDoc;

        target = document.getElementById("test-results-table");
        update_elements();
        pagination_complete = new Promise((resolve) => {
            target.addEventListener("pagination_resolved", () => {
                resolve();
            });
        });
    });

    const update_elements = () => {
        paginate_left = document.querySelector(".paginate-left");
        paginate_right = document.querySelector(".paginate-right");
        paginator_text = document.querySelector(".paginator-text");
    };

    it("paginate_forward", async () => {
        global.fetch = vi.fn();
        vi.mocked(global.fetch).mockResolvedValue(createMockResponse("PAGE 2"));
        initialize_pagination();
        await paginate_right.click();
        await pagination_complete;
        expect(global.fetch).toHaveBeenCalledTimes(1);
        update_elements();
        expect(target.innerHTML).not.toBe(undefined);
        expect(target.innerHTML.trim()).toBe("PAGE 2");
        expect(paginate_left.disabled).toBe(false);
        expect(paginate_right.disabled).toBe(true);
        expect(paginator_text.textContent).toBe("3 - 3 af 3 ${foobar}");

        global.fetch.mockClear();
        paginate_right.disabled = false;
        await paginate_right.click();
        expect(global.fetch).not.toHaveBeenCalled(1);
    });

    it("paginate_back", async () => {
        global.fetch = vi.fn();
        vi.mocked(global.fetch).mockResolvedValue(createMockResponse("PAGE 2"));
        initialize_pagination();
        await paginate_right.click();
        await pagination_complete;
        expect(global.fetch).toHaveBeenCalledTimes(1);

        vi.mocked(global.fetch).mockResolvedValue(createMockResponse("PAGE 1"));
        await paginate_left.click();
        await pagination_complete;
        update_elements();
        expect(target.innerHTML).not.toBe(undefined);
        expect(target.innerHTML.trim()).toBe("PAGE 1");
        expect(paginate_left.disabled).toBe(true);
        expect(paginate_right.disabled).toBe(false);
        expect(paginator_text.textContent).toBe("1 - 2 af 3 ${foobar}");

        global.fetch.mockClear();
        paginate_left.disabled = false;
        await paginate_left.click();
        expect(global.fetch).not.toHaveBeenCalled(1);
    });

    it("paginate_fail", async () => {
        global.fetch = vi.fn();
        vi.mocked(global.fetch).mockResolvedValue(createMockResponseFail());
        initialize_pagination();
        await paginate_right.click();
        await pagination_complete;
        expect(global.fetch).toHaveBeenCalledTimes(1);
        update_elements();
        expect(target.innerHTML).not.toBe(undefined);
        expect(target.innerHTML.trim()).toBe("PAGE 1");
        expect(paginate_left.disabled).toBe(true);
        expect(paginate_right.disabled).toBe(false);
    });
});
