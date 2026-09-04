const drawn = new WeakSet();

// The plot is laid out in percentages of its container, so it can only be drawn
// once the development is on screen
function drawPlot(development) {
    const canvas = development.querySelector(".plot-canvas");
    if (drawn.has(canvas)) {
        return;
    }
    drawn.add(canvas);

    const data = JSON.parse(
        development.querySelector("script[type='application/json']").textContent,
    );

    new Chart(canvas, {
        type: "bar",
        data: {
            datasets: [{ data: data }],
            labels: data.map((value, index) => index),
        },
        options: {
            responsive: false,
            animation: false,
            layout: {
                autoPadding: false,
            },
            scales: {
                x: {
                    display: false,
                    ticks: {
                        display: false,
                    },
                },
                y: {
                    min: 0,
                    max: 100,
                    display: false,
                    ticks: {
                        display: false,
                    },
                },
            },
            plugins: {
                legend: {
                    display: false,
                },
            },
            barThickness: 20,
            elements: {
                bar: {
                    backgroundColor: "#004769",
                },
            },
        },
    });
}

export function initializeStudentDevelopment() {
    const skills = document.getElementById("skills-list");
    const developments = document.querySelectorAll(".student-development");

    function showSkills() {
        for (const development of developments) {
            development.classList.add("d-none");
        }
        skills.classList.remove("d-none");
    }

    for (const development of developments) {
        const open = skills.querySelector(`a[href='#${development.id}']`);
        const back = development.querySelector("a[href='#skills-list']");

        open.addEventListener("click", (evt) => {
            evt.preventDefault();
            skills.classList.add("d-none");
            development.classList.remove("d-none");
            drawPlot(development);
        });

        back.addEventListener("click", (evt) => {
            evt.preventDefault();
            showSkills();
        });
    }

    // Opening the tab always starts at the list of subskills
    document.getElementById("skills-tab").addEventListener("click", showSkills);
}
