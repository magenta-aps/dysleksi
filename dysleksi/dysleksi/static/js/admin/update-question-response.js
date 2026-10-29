export function initUpdateQuestionResponse() {
    const csrfToken = document.querySelector("[name=csrfmiddlewaretoken]").value;
    const form = document.querySelector("form[data-edit-url]");
    const fields = form.querySelectorAll("input.note, input.actual-pronunciation");
    for (const field of fields) {
        field.addEventListener("change", async (evt) => {
            const answerEl = evt.target.parentElement.querySelector(".answer");
            const formData = new FormData();
            formData.set("pk", evt.target.dataset.pk);
            formData.set("attr", evt.target.dataset.attr);
            formData.set("value", evt.target.value);
            fetch(form.dataset.editUrl, {
                method: "POST",
                headers: { "X-CSRFToken": csrfToken },
                body: formData,
            }).then(async (response) => {
                const doc = await response.json();
                /* istanbul ignore else */
                if (answerEl !== null) {
                    const correctness =
                        doc["correctness"] === "correct"
                            ? "correct"
                            : /* istanbul ignore next */ "incorrect";
                    const correctAnswer = doc["correct_answer"];
                    answerEl.classList.remove("answer-correct", "answer-incorrect");
                    answerEl.classList.toggle(`answer-${correctness}`, true);
                    answerEl.innerText =
                        correctness === "correct"
                            ? correctAnswer
                            : /* istanbul ignore next */ gettext("Forkert");
                }
            });
        });
    }
}
