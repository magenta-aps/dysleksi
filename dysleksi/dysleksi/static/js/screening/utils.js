export function extractQuestions(testContents) {
    return testContents.parts.flatMap(part =>
        part.questions.map(q => ({
            partId: part.id,
            partName: part.name,
            questionId: q.id,
            questionType: q.question_type,
            challengeName: q.challenge_name,
            challengeImageUrl: q.challenge_image_url,
            challengeSoundUrl: q.challenge_sound_url,
            challengeText: q.challenge_text,
            choices: q.possible_answers.map(a => ({
                id: a.id,
                text: a.resource_text,
                isCorrect: a.is_correct
            }))
        }))
    );
}

function shuffleArray(array) {
    const arr = [...array]; // do not mutate original
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}


export class TestDomElements {
    instructionsSoundEl;
    introTextEl;
    startPracticeButton;
    startQuestionsButton;
    questionEl;
    choicesEl;
    nextBtn;

    constructor() {
        this.instructionsSoundEl = document.querySelector("#instructions-sound");
        this.introTextEl = document.querySelector("#instructions-text");
        this.startPracticeButton = document.querySelector("#start-practice");
        this.startQuestionsButton = document.querySelector("#start-questions");
        this.questionEl = document.querySelector("#question");
        this.choicesEl = document.querySelector("#choices");
        this.nextBtn = document.querySelector("#next");

        if (!this.instructionsSoundEl || !this.introTextEl || !this.questionEl || !this.choicesEl || !this.nextBtn) {
            throw new Error("Required DOM elements missing");
        }
    }

    showInstructions(text, audio) {
        if (text) {
            this.introTextEl.textContent = text;
        }
        if (audio) {
            const soundSource = document.createElement("source");
            soundSource.src = audio;
            soundSource.type = "audio/mpeg";
            this.instructionsSoundEl.append(soundSource);
        }
        this.startPracticeButton.style.display = "inline-block";
        this.startQuestionsButton.style.display = "inline-block";
    }

    hideInstructions() {
        this.introTextEl.textContent = "";
        this.instructionsSoundEl.innerHTML = "";
    }

    _setButtonListener(button, listener) {
        // Removes existing listeners and sets a new one.
        // by just replacing the whole thing
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        newButton.addEventListener("click", listener);
        return newButton;
    }
    setPracticeButtonListener(listener) {
        this.startPracticeButton = this._setButtonListener(this.startPracticeButton, listener);
    }
    setQuestionsButtonListener(listener) {
        this.startQuestionsButton = this._setButtonListener(this.startQuestionsButton, listener);
    }
    setNextButtonListener(listener) {
        this.nextBtn = this._setButtonListener(this.nextBtn, listener);
    }

    togglePracticeButton(show) {
        this.startPracticeButton.style.display = show ? "inline-block" : "none";
    }
    toggleQuestionsButton(show) {
        this.startQuestionsButton.style.display = show ? "inline-block" : "none";
    }
    toggleNextButton(show) {
        this.nextBtn.style.display = show ? "inline-block" : "none";
    }

    showQuestionTitle(text) {
        this.questionEl.textContent = text || "";
    }
    showQuestionChallenge(text, sound, image_url) {
        // TODO: render text
        let img = document.querySelector("#challenge-image");
        if (image_url) {
            if (!img) {
                img = document.createElement("img");
                img.id = "challenge-image";
                img.style.maxWidth = "300px";
                img.style.display = "block";
                img.style.margin = "1rem 0";
                this.questionEl.after(img);
            }
            img.src = image_url;
        } else {
            if (img) {
                img.remove();
            }
        }

        let playBtn = document.querySelector("#challenge-sound-btn");
        let audio = document.querySelector("#challenge-audio");
    
        if (sound) {
            if (!audio) {
                audio = document.createElement("audio");
                audio.id = "challenge-audio";
                audio.preload = "none";
                audio.style.display = "none"; // hidden audio element
                document.body.appendChild(audio);
            }
    
            audio.src = sound;
            audio.load();
    
            if (!playBtn) {
                playBtn = document.createElement("button");
                playBtn.id = "challenge-sound-btn";
                playBtn.textContent = "▶ Afspil lyd";
                playBtn.className = "btn btn-secondary";
                playBtn.style.margin = "1rem 0";
    
                const insertAfter = img || this.questionEl;
                insertAfter.after(playBtn);
            }
    
            playBtn.onclick = () => {
                audio.currentTime = 0; // restart every time
                audio.play();
            };
        } else {
            if (playBtn) playBtn.remove();
            if (audio) audio.remove();
        }
        
    }
    clearQuestionChoices() {
        this.choicesEl.innerHTML = "";
    }
    showQuestionChoice(text, sound, image_url) {
        const btn = document.createElement("button");
        if (text) {
            btn.textContent = text;
        }
        // TODO: render sound and image
        btn.className = "btn btn-outline-primary";
       this.choicesEl.append(btn);
        return btn;
    }

    showQuestionFreeText(placeholder = "", sound = null, image_url = null) {
        const wrapper = document.createElement("div");
        wrapper.className = "mb-3";
    
        const input = document.createElement("input");
        input.type = "text";
        input.className = "form-control";
        input.placeholder = placeholder;
    
        wrapper.append(input);
        this.choicesEl.append(wrapper);
    
        return input;
    }

    
}

/*
* Flow:
*   for part in parts:
*     display instructions
*     user clicks "start practice" button
*     for question in part.practice:
*       user answers question, or clicks "start test" button
*     for question in part.questions:
*       user answers question
*
* */

export class Test {
    name;
    parts;
    current_part;
    part_index;
    chat_socket;
    room_name;
    dom_elements;
    on_complete;

    constructor(data, chat_socket, room_name, on_complete) {
        this.name = data.name;
        this.dom_elements = new TestDomElements();
        this.parts = data.parts.map((data_item, index) => new TestPart(data_item, this, index));
        this.part_index = 0;
        this.current_part = null;
        if (this.parts.length === 0) {
            throw new Error("Test has no parts");
        }
        this.chat_socket = chat_socket;
        this.room_name = room_name;
        this.on_complete = on_complete;
    }

    start() {
        this.current_part = this.parts[0];
        this.current_part.start();
    }

    showPart(index) {
        if (index >= this.parts.length) {
            // throw new Error("Cannot show part index " + index + ", only " + this.parts.length + " parts available.");
            return false;
        }
        this.part_index = index;
        this.current_part = this.parts[index];
        this.current_part.start();
        return true;
    }

    onPartComplete() {
        if (this.showPart(this.part_index + 1)) {
            // next part is being shown
        } else {
            this.onComplete();
        }
    }

    onComplete() {
        this.dom_elements.clearQuestionChoices();
        this.dom_elements.hideInstructions();
        this.dom_elements.showQuestionTitle();
        this.dom_elements.showQuestionChallenge();
        this.dom_elements.togglePracticeButton(false);
        this.dom_elements.toggleQuestionsButton(false);
        this.dom_elements.toggleNextButton(false);
        alert("Testen er færdig!");
        this.send({
            event: "test.completed",
            message: "Testen er afsluttet"
        });
        if (this.on_complete) {
            this.on_complete();
        }
    }

    send(data) {
        data.id = this.room_name;
        this.chat_socket.send(JSON.stringify(data));
    }
}


class TestPart {
    test;
    id;
    index;
    name;
    instructions_url;
    intro;
    timeout;
    partial_score_after;
    questions;
    practice;

    question_index;
    is_practicing;
    current_question;

    constructor(data, test, index) {
        this.test = test;
        this.index = index;
        this.dom_elements = test.dom_elements;
        this.id = data.id;
        this.name = data.name;
        this.instructions_url = data.instructions_url;
        this.intro = data.intro;
        this.timeout = data.timeout;
        this.partial_score_after = data.partial_score_after;
        this.questions = data.questions.map((data_item, index) => new Question(data_item, this, index));
        this.practice = data.practice.map((data_item, index) => new Question(data_item, this, index));
        this.is_practicing = false;
        this.question_index = 0;
        this.current_question = null;
    }

    start() {
        this.dom_elements.showInstructions(this.intro, this.instructions_url);
        this.dom_elements.showQuestionTitle();
        this.dom_elements.showQuestionChallenge();
        this.dom_elements.clearQuestionChoices();
        this.dom_elements.toggleNextButton(false);
        this.dom_elements.togglePracticeButton(this.canPractice());
        this.dom_elements.setPracticeButtonListener(() => this.showFirstQuestion(true));
        this.dom_elements.toggleQuestionsButton(true);
        this.dom_elements.setQuestionsButtonListener(() => this.showFirstQuestion(false));
    }

    canPractice() {
        return this.practice.length > 0;
    }

    showFirstQuestion(is_practicing) {
        this.showQuestion(is_practicing, 0);
        this.dom_elements.togglePracticeButton(false);
        if (!is_practicing) {
            this.dom_elements.toggleQuestionsButton(false);
        }
    }
    showNextQuestion() {
        return this.showQuestion(this.is_practicing, this.question_index + 1);
    }
    showQuestion(is_practicing, index) {
        this.question_index = index;
        this.is_practicing = is_practicing;
        const questions = this.is_practicing ? this.practice : this.questions;
        if (index >= questions.length) {
            //throw new Error("Cannot show question index " + index + ", only " + questions.length + " questions available.")
            return false;
        }
        this.current_question = this.questions[index];
        this.current_question.show();
        this.dom_elements.toggleNextButton(true);
        return true;
    }
    questions_count() {
        return this.is_practicing ? this.practice.length : this.questions.length;
    }
    onQuestionComplete() {
        if (this.showNextQuestion()) {
            // Next question is being shown
        } else {
            // no more questions in set
            if (this.is_practicing) {
                // finished practicing
                this.dom_elements.showQuestionTitle();
                this.dom_elements.showQuestionChallenge();
                this.dom_elements.toggleNextButton(false);
                this.dom_elements.clearQuestionChoices();
                this.dom_elements.toggleQuestionsButton(true);
            } else {
                // part complete
                this.test.onPartComplete();
            }
        }
    }
}

class Question {
    part;
    id;
    question_type;
    index;
    challenge_id;
    challenge_name;
    challenge_image_url;
    challenge_sound_url;
    challenge_text;
    possible_answers;
    displayed_at;
    answered_at;
    selected_choice;
    dom_elements;

    constructor(data, part, index) {
        this.part = part;
        this.index = index;
        this.dom_elements = part.dom_elements;
        this.id = data.id;
        this.question_type = data.question_type;
        this.challenge_id = data.challenge_id;
        this.challenge_name = data.challenge_name;
        this.challenge_image_url = data.challenge_image_url;
        this.challenge_sound_url = data.challenge_sound_url;
        this.challenge_text = data.challenge_text;
        this.possible_answers = data.possible_answers.map(data_item => new PossibleAnswer(data_item, this));
    }

    show() {
        this.displayed_at = document.timeline.currentTime;
        this.selected_choice = null;

        this.dom_elements.showQuestionTitle(`${this.index + 1}/${this.part.questions_count()} (${this.part.name})`);
        this.dom_elements.showQuestionChallenge(this.challenge_text, this.challenge_sound_url, this.challenge_image_url);
        this.dom_elements.toggleNextButton(false);
        this.dom_elements.clearQuestionChoices();

        let answers = this.possible_answers;
        if (!this.isPracticing()) {
            answers = shuffleArray(answers);
        }

        for (let answer of answers) {
            answer.show();
        }
        this.dom_elements.setNextButtonListener(() => this.onComplete());
    }
    select(answer) {
        this.selected_choice = answer;
        this.dom_elements.toggleNextButton(true);
    }
    isPracticing() {
        return this.part.is_practicing;
    }
    isLast() {
        return this.index === this.part.questions_count() - 1;
    }
    onComplete() {
        if (!this.selected_choice) {
            alert("Vælg et svar, før du går videre.");
            return;
        }
        this.answered_at = document.timeline.currentTime;
        if (this.isPracticing()) {
            if (this.selected_choice.is_correct) {
                if (this.isLast()) {
                    alert("Øveopgaver gennemført. Begynd den rigtige test")
                } else {
                    alert("Ja, det er rigtigt. Prøv næste øveopgave.");
                }
                this.part.onQuestionComplete();
            } else {
                alert("Nej, det er forkert. Prøv at vælge igen.");
                this.show();
            }
        } else {
            const duration = ((this.answered_at - this.displayed_at) / 1000).toFixed(1);
            this.part.test.send({
                event: "test.answered",
                message: `Elev har gennemført spørgsmål ${this.index + 1}`,
                choice: this.selected_choice.id,
                index: this.index,
                displayedAt: this.displayed_at,
                answeredAt: this.answered_at,
                duration: duration
            });
            this.part.onQuestionComplete();
        }
    }
}

class PossibleAnswer {
    question;
    id;
    resource_id;
    resource_name;
    resource_image_url;
    resource_sound_url;
    resource_text;
    is_correct;
    button;

    constructor(data, question) {
        this.question = question;
        this.question_type = question.question_type;
        this.dom_elements = question.dom_elements;
        this.id = data.id;
        this.resource_id = data.resource_id;
        this.resource_name = data.resource_name;
        this.resource_image_url = data.resource_image_url;
        this.resource_sound_url = data.resource_sound_url;
        this.resource_text = data.resource_text;
        this.is_correct = data.is_correct;
    }

    show() {
        if (this.question_type == "multiple_choice"){
            this.button = this.dom_elements.showQuestionChoice(this.resource_text, this.resource_sound_url, this.resource_image_url);
            this.button.addEventListener("click", () => this.select());
        } else if (this.question_type == "free_text"){
            this.input = this.dom_elements.showQuestionFreeText();
            this.input.addEventListener("input", () => this.selectFreeText());
        }
    }
    select() {
        this.question.select(this);
        this.button.classList.add("btn-primary");
        this.button.classList.remove("btn-outline-primary");
        for (let other_answer of this.question.possible_answers) {
            if (other_answer !== this) {
                other_answer.button.classList.add("btn-outline-primary");
                other_answer.button.classList.remove("btn-primary");
            }
        }
    }
    selectFreeText() {
        if (this.input.value.trim() !== "") {
            this.question.select(this);
        }    
    }
}
