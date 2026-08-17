import * as bootstrap from "bootstrap";

export function initializeSidebar() {
    const collapseToggles = document.querySelectorAll(".navigation [data-bs-toggle]");
    for (const collapseToggle of collapseToggles) {
        collapseToggle.addEventListener("click", (evt) => {
            evt.preventDefault();
            // Update collapsible element
            const collapseInstance = bootstrap.Collapse.getOrCreateInstance(
                collapseToggle.dataset.bsTarget,
            );
            collapseInstance.toggle();
            // Update "toggle" element
            const caret = collapseToggle.querySelector("i[class*='ph-caret']");
            caret.classList.toggle("ph-caret-up");
            caret.classList.toggle("ph-caret-down");
        });
    }
}
