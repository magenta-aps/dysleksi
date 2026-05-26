function format(template, data) {
    return template.replace(/\${([^}]+)}/g, (match, key) => data[key] ?? match);
}

export function paginate(container) {
    const target = document.getElementById(
        container.getAttribute("data-pagination-target"),
    );
    const page_param = container.getAttribute("data-pagination-page-param");
    const content_param = container.getAttribute("data-pagination-content-param");
    const pagination = JSON.parse(
        document.getElementById(container.getAttribute("data-pagination-details"))
            .textContent,
    );
    const paginator_text = container.querySelector(".paginator-text");
    const paginate_left = container.querySelector(".paginate-left");
    const paginate_right = container.querySelector(".paginate-right");
    const paginate_to = container.querySelectorAll(".paginate-to");
    const pagination_format_str = paginator_text.getAttribute("data-format");
    const page_urlparams = new URLSearchParams(window.location.search);
    const table_urlparams = new URLSearchParams(window.location.search);

    const goto_page = async function (page) {
        /* istanbul ignore else -- @preserve */
        if (page) {
            page_urlparams.set(page_param, page);
            table_urlparams.set(page_param, page);
            table_urlparams.set(content_param, "true");
            const response = await fetch("?" + table_urlparams.toString());
            if (response.ok) {
                target.innerHTML = await response.text();
                pagination.current_page = page;
                pagination.current_first = (page - 1) * pagination.page_size + 1;
                pagination.current_last = Math.min(
                    pagination.total_count,
                    page * pagination.page_size,
                );
                paginator_text.textContent = format(pagination_format_str, {
                    first: pagination.current_first,
                    last: pagination.current_last,
                    total: pagination.total_count,
                });
                paginate_left.disabled = page === 1;
                paginate_right.disabled = page === pagination.last_page;

                for (let element of paginate_to) {
                    let element_page = parseInt(element.getAttribute("data-page"));
                    element.classList.toggle("current", page === element_page);
                }

                history.replaceState(null, null, "?" + page_urlparams.toString());
            }
            target.dispatchEvent(new Event("pagination_resolved"));
        }
    };
    paginate_left.addEventListener("click", () => {
        if (pagination.current_page > 1) {
            goto_page(pagination.current_page - 1);
        }
    });
    paginate_right.addEventListener("click", () => {
        if (pagination.current_page < pagination.last_page) {
            goto_page(pagination.current_page + 1);
        }
    });
    for (let element of paginate_to) {
        element.addEventListener("click", function () {
            const page = parseInt(this.getAttribute("data-page"));
            goto_page(page);
        });
    }
}

export function initialize_pagination() {
    for (let pagination_container of document.querySelectorAll(
        "[data-pagination-details]",
    )) {
        paginate(pagination_container);
    }
}
