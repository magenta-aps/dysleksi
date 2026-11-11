/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { initializeStats } from "../../admin/stats.js";

const mockDoc = `
<form id="stats-filter">
    <input type="hidden" name="school" value="">
    <div class="school-picker">
        <input type="search">
        <button type="button" data-school="">Alle skoler</button>
        <button type="button" data-school="1">Nuuk Skole</button>
        <button type="button" data-school="2">Sisimiut Skole</button>
    </div>
    <input type="checkbox" name="grades" value="1" checked>
    <input type="checkbox" name="grades" value="2">
    <input type="checkbox" name="grades" value="3" checked>
    <input type="radio" name="gender" value="split" checked>
    <input type="radio" name="gender" value="male">
    <input type="radio" name="test_type" value="both" checked>
    <input type="checkbox" name="untested" checked>
</form>
<table class="stats-table"></table>
`;

describe("stats", () => {
    beforeEach(() => {
        document.body.innerHTML = mockDoc;
        initializeStats();
    });

    it("shows the selected rows and columns right away", () => {
        const form = document.querySelector("#stats-filter");
        form.querySelector("[value='male']").checked = true;
        form.querySelector("[name='untested']").checked = false;
        form.dispatchEvent(new Event("change"));

        const table = document.querySelector(".stats-table");
        expect(table.dataset).toMatchObject({
            grades: "1 3",
            gender: "male",
            testType: "both",
            untested: "false",
        });
        expect(window.location.search).toBe(
            "?school=&grades=1&grades=3&gender=male&test_type=both",
        );
    });

    it("searches for schools", () => {
        const search = document.querySelector("input[type=search]");
        search.value = "nuuk";
        search.dispatchEvent(new Event("input"));
        const hidden = [...document.querySelectorAll("[data-school]")].map(
            (school) => school.hidden,
        );
        expect(hidden).toEqual([true, false, true]);

        const enter = new KeyboardEvent("keydown", { key: "Enter", cancelable: true });
        search.dispatchEvent(enter);
        expect(enter.defaultPrevented).toBe(true);
        const escape = new KeyboardEvent("keydown", {
            key: "Escape",
            cancelable: true,
        });
        search.dispatchEvent(escape);
        expect(escape.defaultPrevented).toBe(false);
    });

    it("submits the selected school", () => {
        const form = document.querySelector("#stats-filter");
        const spySubmit = vi.spyOn(form, "submit").mockImplementation(() => {});
        document.querySelector("[data-school='2']").click();
        expect(form.elements.school.value).toBe("2");
        expect(spySubmit).toHaveBeenCalled();
    });
});
