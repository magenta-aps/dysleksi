export function initUpdateQuestionResponse() {
    const csrfToken = document.querySelector("[name=csrfmiddlewaretoken]").value;
    const form = document.querySelector("form[data-edit-url]");
    const fields = form.querySelectorAll("input.note, input.actual-pronunciation");
    for (const field of fields) {
        field.addEventListener("change", async (evt) => {
            const formData = new FormData();
            formData.set("pk", evt.target.dataset.pk);
            formData.set("attr", evt.target.dataset.attr);
            formData.set("value", evt.target.value);
            await fetch(form.dataset.editUrl, {
                method: "POST",
                headers: { "X-CSRFToken": csrfToken },
                body: formData,
            });
        });
    }
}
