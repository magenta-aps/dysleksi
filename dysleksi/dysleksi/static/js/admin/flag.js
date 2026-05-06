export function initialize_flagging() {
    const flag_links = document.querySelectorAll(".student-flag-link");
    const csrf_token = document.querySelector("[name=csrfmiddlewaretoken]").value;
    const flag_url_base = JSON.parse(document.getElementById("flag_url").textContent);
    for (let flag_link of flag_links) {
        flag_link.addEventListener("click", async function () {
            const pk = this.getAttribute("data-response-pk");
            const url = flag_url_base.replace("/0", "/" + pk);
            const form = new FormData();
            form.set("flagged", this.classList.contains("flagged") ? "false" : "true");
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "X-CSRFToken": csrf_token,
                },
                body: form,
            });
            if (response.ok) {
                const data = await response.json();
                if (data && (data.flagged === true || data.flagged === false)) {
                    for (let other_flag_link of document.querySelectorAll(
                        "[data-response-pk='" + pk + "']",
                    )) {
                        other_flag_link.classList.toggle("flagged", data.flagged);
                    }
                }
            }
            flag_link.dispatchEvent(new Event("flag_resolved"));
        });
    }
}
