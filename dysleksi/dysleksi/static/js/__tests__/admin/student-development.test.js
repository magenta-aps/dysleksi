/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { initializeStudentDevelopment } from "../../admin/student-development.js";

const mockDoc = `
<button id="skills-tab">Delfærdigheder</button>
<div id="skills-list">
    <a href="#development-1">Se udvikling</a>
</div>
<div class="student-development d-none" id="development-1">
    <a href="#skills-list">Tilbage</a>
    <canvas class="plot-canvas"></canvas>
    <script type="application/json">[25, 100]</script>
</div>
`;

describe("student-development", () => {
    let chart;

    beforeEach(() => {
        document.body.innerHTML = mockDoc;
        chart = vi.fn();
        vi.stubGlobal("Chart", chart);
        initializeStudentDevelopment();
    });

    it("reveals the development of a subskill and draws its plot", () => {
        const skills = document.getElementById("skills-list");
        const development = document.getElementById("development-1");

        skills.querySelector("a").dispatchEvent(new Event("click"));

        expect(skills.classList).toContain("d-none");
        expect(development.classList).not.toContain("d-none");
        const [canvas, config] = chart.mock.calls[0];
        expect(canvas).toBe(development.querySelector(".plot-canvas"));
        expect(config.data.datasets[0].data).toEqual([25, 100]);
    });

    it("flips between development and skills view", () => {
        const skills = document.getElementById("skills-list");
        const development = document.getElementById("development-1");
        const open = skills.querySelector("a");
        const back = development.querySelector("a");

        open.dispatchEvent(new Event("click"));
        back.dispatchEvent(new Event("click"));

        expect(skills.classList).not.toContain("d-none");
        expect(development.classList).toContain("d-none");

        // Check that opening the development tab does not re-draw the chart.
        open.dispatchEvent(new Event("click"));
        expect(chart).toHaveBeenCalledOnce();
    });

    it("always returns to the list of subskills when the tab button is pressed", () => {
        const skills = document.getElementById("skills-list");
        const development = document.getElementById("development-1");

        skills.querySelector("a").dispatchEvent(new Event("click"));
        document.getElementById("skills-tab").dispatchEvent(new Event("click"));

        expect(skills.classList).not.toContain("d-none");
        expect(development.classList).toContain("d-none");
    });
});
