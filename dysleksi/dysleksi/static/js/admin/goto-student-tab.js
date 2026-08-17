import * as bootstrap from "bootstrap";

export function initializeGoToStudentTab() {
    const anchor = document.querySelector("a[href='#goto-students-tab']");
    anchor.addEventListener("click", (evt) => {
        evt.preventDefault();
        const studentsTab = new bootstrap.Tab("#students-tab");
        studentsTab.show();
    });
}
