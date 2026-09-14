import * as bootstrap from "bootstrap";

export function initializeGoToStudentTab() {
    const anchor = document.querySelector("a[href='#goto-students-tab']");
    anchor.addEventListener("click", (evt) => {
        evt.preventDefault();
        const studentsTab = new bootstrap.Tab("#students-tab");
        studentsTab.show();
    });
    // Remember the tab in the URL to handle reloads and pagination
    for (const tab of document.querySelectorAll("#myTab [data-bs-toggle='tab']")) {
        tab.addEventListener("shown.bs.tab", (evt) => {
            const params = new URLSearchParams(window.location.search);
            params.set("tab", evt.target.id);
            history.replaceState(null, "", "?" + params.toString());
        });
    }
}
