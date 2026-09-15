export function initEditNote() {
    const csrfToken = document.querySelector("[name=csrfmiddlewaretoken]").value;
    const form = document.querySelector("form[data-edit-url]");
    const noteFields = form.querySelectorAll("input.note");
    for (const noteField of noteFields) {
        noteField.addEventListener("change", async (evt) => {
            const formData = new FormData();
            formData.set("pk", evt.target.dataset.pk);
            formData.set("note", evt.target.value);
            await fetch(form.dataset.editUrl, {
                method: "POST",
                headers: { "X-CSRFToken": csrfToken },
                body: formData,
            });
        });
    }
}
