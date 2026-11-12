export function initializeStats() {
    const form = document.querySelector("#stats-filter");
    const table = document.querySelector(".stats-table");
    form.addEventListener("change", () => {
        const data = new FormData(form);
        table.dataset.grades = data.getAll("grades").join(" ");
        table.dataset.gender = data.get("gender");
        table.dataset.testType = data.get("test_type");
        table.dataset.untested = data.has("untested");
        history.replaceState(null, "", "?" + new URLSearchParams(data));
    });

    const search = form.querySelector(".school-picker input[type=search]");
    const schools = form.querySelectorAll("[data-school]");
    search.addEventListener("input", () => {
        const query = search.value.toLowerCase();
        for (const school of schools) {
            school.hidden = !school.textContent.toLowerCase().includes(query);
        }
    });
    // Enter would otherwise submit the form through its first submit button (export)
    search.addEventListener("keydown", (evt) => {
        if (evt.key === "Enter") {
            evt.preventDefault();
        }
    });
    for (const school of schools) {
        school.addEventListener("click", () => {
            form.elements.school.value = school.dataset.school;
            form.submit();
        });
    }
}
