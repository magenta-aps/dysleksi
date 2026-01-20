import { getWebSocket } from "../../ws.js";

export function initStudent(roomName, testContents) {
    const chatSocket = getWebSocket(roomName);

    const questionEl = document.querySelector("#question");
    const choicesEl = document.querySelector("#choices");
    const nextBtn = document.querySelector("#next");

    if (!questionEl || !choicesEl || !nextBtn) {
        console.error("Required DOM elements missing");
        return;
    }

    // Flatten all questions
    const tests = testContents.parts.flatMap(part =>
        part.questions.map(q => ({
            partId: part.id,
            partName: part.name,
            questionId: q.id,
            challengeName: q.challenge_name,
            challengeImageUrl: q.challenge_image_url,
            challengeSoundUrl: q.challenge_sound_url,
            choices: q.possible_answers.map(a => ({
                id: a.id,
                text: a.resource_text,
                isCorrect: a.is_correct
            }))
        }))
    );

    let testIndex = 0;
    let displayedAt = 0;
    let selectedChoice = null;


    function shuffleArray(array) {
        const arr = [...array]; // do not mutate original
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    const updateTest = () => {
        const test = tests[testIndex];
        displayedAt = document.timeline.currentTime;
        selectedChoice = null;

        questionEl.textContent = `${testIndex + 1}/${tests.length} (${test.partName})`;
        choicesEl.innerHTML = "";
        nextBtn.style.display = "none";

        const shuffledChoices = shuffleArray(test.choices);
    
        for (const choice of shuffledChoices) {
            const btn = document.createElement("button");
            btn.textContent = choice.text;
            btn.className = "btn btn-outline-primary";
            btn.addEventListener("click", () => selectChoice(btn));
            choicesEl.append(btn);
        }

        if (test.challengeImageUrl) {
            let img = document.querySelector("#challenge-image");
            if (!img) {
                img = document.createElement("img");
                img.id = "challenge-image";
                img.style.maxWidth = "300px";
                img.style.display = "block";
                img.style.margin = "1rem 0";
                questionEl.after(img);
            }
            img.src = test.challengeImageUrl;
        }
    };

    const selectChoice = (btn) => {
        selectedChoice = btn.textContent;
        choicesEl.querySelectorAll("button").forEach(b => {
            b.className = b === btn ? "btn btn-primary" : "btn btn-outline-primary";
        });
        nextBtn.style.display = "inline-block";
    };

    const nextQuestion = () => {
        if (!selectedChoice) {
            alert("Vælg et svar, før du går videre.");
            return;
        }

        const answeredAt = document.timeline.currentTime;
        const duration = ((answeredAt - displayedAt) / 1000).toFixed(1);

        chatSocket.send(JSON.stringify({
            event: "test.answered",
            id: roomName,
            message: `Elev har gennemført spørgsmål ${testIndex + 1}`,
            choice: selectedChoice,
            index: testIndex,
            displayedAt,
            answeredAt,
            duration
        }));

        if (testIndex < tests.length - 1) {
            testIndex++;
            updateTest();
        } else {
            alert("Testen er færdig!");
            chatSocket.send(JSON.stringify({
                event: "test.completed",
                id: roomName,
                message: "Testen er afsluttet"
            }));
        }
    };

    nextBtn.addEventListener("click", nextQuestion);

    chatSocket.addEventListener("open", updateTest);
}
