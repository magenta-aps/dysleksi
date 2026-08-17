/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { initializeGoToStudentTab } from "../../admin/goto-student-tab.js";
import { Tab } from "bootstrap";

const mockDoc = `
<ul class="nav" id="myTab" role="tablist">
    <li class="nav-item" role="presentation">
        <button class="nav-link active" id="master-data-tab" data-bs-toggle="tab" data-bs-target="#master-data-tab-pane" type="button"
                role="tab" aria-controls="master-data-tab-pane" aria-selected="true">
        </button>
    </li>
    <li class="nav-item" role="presentation">
        <button class="nav-link" id="students-tab" data-bs-toggle="tab" data-bs-target="#students-tab-pane" type="button"
                role="tab" aria-controls="students-tab-pane" aria-selected="false">
        </button>
    </li>
</ul>
<div class="tab-content" id="myTabContent">
    <div class="tab-pane fade show active" id="master-data-tab-pane" role="tabpanel" aria-labelledby="master-data-tab" tabindex="0">
        <a href="#goto-students-tab"></a>
    </div>
    <div class="tab-pane fade" id="students-tab-pane" role="tabpanel" aria-labelledby="students-tab" tabindex="0">
        ...
    </div>
</div>
`;

describe("goto-student-tab", () => {
    beforeEach(() => {
        document.body.innerHTML = mockDoc;
    });

    it("listens for click events", () => {
        const link = document.querySelector("a[href='#goto-students-tab']");
        const spyShow = vi.spyOn(Tab.prototype, "show");
        initializeGoToStudentTab();
        link.dispatchEvent(new Event("click"));
        expect(spyShow).toHaveBeenCalled();
    });
});
