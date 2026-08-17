/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { initializeSidebar } from "../../admin/sidebar.js";
import { Collapse } from "bootstrap";

const mockDoc = `
<div class="navigation">
    <li class="nav-item">
            <span data-bs-toggle="collapse" data-bs-target="#collapseClasses" aria-expanded="false" aria-controls="collapseClasses">
                <i class="ph ph-caret-up"></i>
            </span>
        </a>
    </li>
    <ul class="navbar-nav collapse" id="collapseClasses">
        <li class="nav-item">item</li>
    </ul>
</div>
`;

describe("sidebar", () => {
    beforeEach(() => {
        document.body.innerHTML = mockDoc;
    });

    it("listens for click events", () => {
        const link = document.querySelector("[data-bs-toggle]");
        const spyToggle = vi.spyOn(Collapse.prototype, "toggle");
        initializeSidebar();
        link.dispatchEvent(new Event("click"));
        expect(spyToggle).toHaveBeenCalled();
    });
});
