import {shuffleArray} from "./utils.js";

class Test extends EventTarget {

    name;
    parts;
    currentPart;
    partIndex;
    chatSocket;
    roomName;
    domElements;

    constructor(data, chatSocket, roomName, domElements) {
        super()
        this.name = data.name;
        this.domElements = domElements;
        this.partIndex = 0;
        this.currentPart = null;
        this.chatSocket = chatSocket;
        this.roomName = roomName;
        this.chatSocket.addEventListener("message", (e) => {
            this.onChatMessage(JSON.parse(e.data));
        });
    }

    start() {
        this.currentPart = this.parts[0];
        this.currentPart.start();
    }

    next() {
        this.currentPart.onQuestionComplete();
    }

    showPart(index) {
        if (index >= this.parts.length) {
            // throw new Error("Cannot show part index " + index + ", only " + this.parts.length + " parts available.");
            return false;
        }
        this.partIndex = index;
        this.currentPart = this.parts[index];
        this.currentPart.start();
        return true;
    }

    onQuestionComplete(part, question) {
        this.dispatchEvent(new Event("question.complete", {
            test: this,
            part: part,
            question: question
        }));
    }

    onPartComplete(part) {
        this.dispatchEvent(new Event("part.complete", {
            test: this,
            part: part
        }));
        if (this.showPart(this.partIndex + 1)) {
            console.log("Part complete, showing next part");
            // next part is being shown
        } else {
            console.log("Part complete, no more parts");
            this.onComplete();
        }
    }

    async onComplete() {
        console.log("Test complete");
        this.domElements.hideInstructions();
        this.domElements.showQuestionTitle();
        this.domElements.showQuestionChallenge();

        alert("Testen er færdig!");
        this.send({
            event: "test.completed",
            message: "Testen er afsluttet"
        });

        this.dispatchEvent(new Event("test.complete", {
            test: this
        }));
    }

    send(data) {
        data.id = this.roomName;
        console.log("Chat: sending", data);
        this.chatSocket.send(JSON.stringify(data));
    }

    onChatMessage(data) {
        console.log("Chat: received", data);
    }

}

export class GroupTest extends Test {

    constructor(data, chatSocket, roomName, domElements) {
        super(data, chatSocket, roomName, domElements);
        this.parts = data.parts.map((dataItem, index) => new GroupTestPart(dataItem, this, index));
        if (this.parts.length === 0) {
            throw new Error("Test has no parts");
        }
    }

}

export class IndividualTest extends Test {

    mediaRecorder;

    constructor(data, chatSocket, roomName, domElements, mediaRecorder) {
        super(data, chatSocket, roomName, domElements);
        this.parts = data.parts.map((dataItem, index) => new IndividualTestPart(dataItem, this, index));
        if (this.parts.length === 0) {
            throw new Error("Test has no parts");
        }
        this.mediaRecorder = mediaRecorder;
    }

    onChatMessage(data) {
        super.onChatMessage(data);

        if (data.event.match(/test\.(correct|wrong|skipped)/)) {
            let outcome = null;
            if (data.event === "test.correct" || data.event === "wrong") {
                outcome = (data.event === "test.correct");
            }
            this.teacherFeedback(outcome);
        }
    }

    async teacherFeedback(outcome) {
        await this.currentPart.currentQuestion.teacherFeedback(outcome)
    }

    async onComplete() {
        if (this.mediaRecorder) {
            await this.mediaRecorder.stop();
        }
        super.onComplete();
    }
}


class TestPart {

    test;
    id;
    index;
    name;
    instructionsUrl;
    intro;
    timeout;
    partialScoreAfter;
    questions;
    questionIndex;
    currentQuestion;

    constructor(data, test, index) {
        this.test = test;
        this.index = index;
        this.domElements = test.domElements;
        this.id = data.id;
        this.name = data.name;
        this.instructionsUrl = data.instructions_url;
        this.intro = data.intro;
        this.timeout = data.timeout;
        this.partialScoreAfter = data.partial_score_after;
        this.questionIndex = 0;
        this.currentQuestion = null;
    }

    start() {
        console.log("Starting test part " + this.index + " (" + this.name + ")");
        this.domElements.showInstructions(this.intro, this.instructionsUrl);
        this.domElements.showQuestionTitle();
        this.domElements.showQuestionChallenge();
    }

    onComplete() {
        this.test.onPartComplete(this);
    }

    onQuestionComplete(question) {
        this.test.onQuestionComplete(this, question);
    }

    canPractice() {
        return this.practice.length > 0;
    }

    showFirstQuestion(isPracticing) {
        return this.showQuestion(isPracticing, 0);
    }

    showNextQuestion() {
        return this.showQuestion(this.isPracticing, this.questionIndex + 1);
    }

    showQuestion(isPracticing, index) {
        this.questionIndex = index;
        this.isPracticing = isPracticing;
        const questions = this.isPracticing ? this.practice : this.questions;
        if (index >= questions.length) {
            //throw new Error("Cannot show question index " + index + ", only " + questions.length + " questions available.")
            return false;
        }
        this.currentQuestion = this.questions[index];
        this.currentQuestion.show();
        return true;
    }

}


class GroupTestPart extends TestPart {

    practice;
    isPracticing;

    constructor(data, test, index) {
        super(data, test, index);
        this.practice = data.practice.map((dataItem, index) => new GroupQuestion(dataItem, this, index));
        this.questions = data.questions.map((dataItem, index) => new GroupQuestion(dataItem, this, index));
        this.isPracticing = false;
    }

    start() {
        super.start();
        this.domElements.clearQuestionChoices();
        this.domElements.toggleNextButton(false);
        this.domElements.togglePracticeButton(this.canPractice());
        this.domElements.setPracticeButtonListener(() => this.showFirstQuestion(true));
        this.domElements.toggleQuestionsButton(true);
        this.domElements.setQuestionsButtonListener(() => this.showFirstQuestion(false));
    }

    onComplete() {
        this.domElements.clearQuestionChoices();
        this.domElements.toggleNextButton(false);
        this.domElements.togglePracticeButton(false);
        this.domElements.toggleQuestionsButton(false);
        super.onComplete();
    }

    showFirstQuestion(isPracticing) {
        const result = super.showFirstQuestion(isPracticing);
        if (result) {
            this.domElements.togglePracticeButton(false);
            if (!isPracticing) {
                this.domElements.toggleQuestionsButton(false);
            }
        }
        return result;
    }

    showQuestion(isPracticing, index) {
        this.domElements.toggleNextButton(true);
        return super.showQuestion(isPracticing, index);
    }

    questionsCount() {
        return this.isPracticing ? this.practice.length : this.questions.length;
    }

    onQuestionComplete(question) {
        if (this.showNextQuestion()) {
            // Next question is being shown
        } else {
            // no more questions in set
            if (this.isPracticing) {
                // finished practicing
                this.domElements.showQuestionTitle();
                this.domElements.showQuestionChallenge();
                this.domElements.toggleNextButton(false);
                this.domElements.clearQuestionChoices();
                this.domElements.toggleQuestionsButton(true);
            } else {
                // part complete
                this.onComplete();
            }
        }
    }

}

class IndividualTestPart extends TestPart{

    constructor(data, test, index) {
        super(data, test, index);
        this.questions = data.questions.map((dataItem, index) => new IndividualQuestion(dataItem, this, index));
    }

    start() {
        super.start();
        this.showFirstQuestion(this.isPracticing);
    }

    questionsCount() {
        return this.questions.length;
    }

    onQuestionComplete(question) {
        if (this.showNextQuestion()) {
            // Next question is being shown
        } else {
            // no more questions in set
            this.onComplete();
        }
    }

}

class Question {

    part;
    id;
    question_type;
    index;
    challengeId;
    challengeName;
    challengeImageUrl;
    challengeSoundUrl;
    challengeText;
    possibleAnswers;
    displayedAt;
    answeredAt;
    selectedChoice;
    domElements;

    constructor(data, part, index) {
        this.part = part;
        this.index = index;
        this.domElements = part.domElements;
        this.question_type = data.question_type;
        this.id = data.id;
        this.challengeId = data.challenge_id;
        this.challengeName = data.challenge_name;
        this.challengeImageUrl = data.challenge_image_url;
        this.challengeSoundUrl = data.challenge_sound_url;
        this.challengeText = data.challenge_text;
        this.possibleAnswers = data.possible_answers.map(dataItem => new PossibleAnswer(dataItem, this));
    }

    show() {
        console.log("---------------------------------------------")
        console.log("Showing question " + this.part.index+"."+this.index);
        this.displayedAt = document.timeline.currentTime;
        this.selectedChoice = null;
        this.domElements.showQuestionTitle(`${this.index + 1}/${this.part.questionsCount()} (${this.part.name})`);
        this.domElements.showQuestionChallenge(this.challengeText, this.challengeSoundUrl, this.challengeImageUrl);
    }

    onShow() {
        this.part.test.send({
            event: 'test.displayed',
            index: this.index,
            displayedAt: this.displayedAt,
        });
    }

    select(answer) {
        this.selectedChoice = answer;
        this.domElements.toggleNextButton(true);
    }

    isPracticing() {
        return this.part.isPracticing;
    }

    isLast() {
        return this.index === this.part.questionsCount() - 1;
    }

    onComplete() {
        this.answeredAt = document.timeline.currentTime;
    }
}

class GroupQuestion extends Question {

    constructor(data, part, index) {
        super(data, part, index);
    }

    show() {
        super.show();

        this.domElements.toggleNextButton(false);
        this.domElements.setNextButtonListener(() => this.onComplete());

        this.domElements.clearQuestionChoices();
        let answers = this.possibleAnswers;
        if (!this.isPracticing()) {
            answers = shuffleArray(answers);
        }

        for (let answer of answers) {
            answer.show();
        }
        super.onShow();
    }

    onComplete() {
        super.onComplete();
        if (!this.selectedChoice) {
            alert("Vælg et svar, før du går videre.");
            return;
        }
        if (this.isPracticing()) {
            if (this.selectedChoice.isCorrect) {
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
            const duration = ((this.answeredAt - this.displayedAt) / 1000).toFixed(1);
            this.part.test.send({
                event: "test.answered",
                message: `Elev har gennemført spørgsmål ${this.index + 1}`,
                choice: this.selectedChoice.id,
                recordingBase64: null,
                index: this.index,
                displayedAt: this.displayedAt,
                answeredAt: this.answeredAt,
                duration: duration
            });
            this.part.onQuestionComplete();
        }
    }

}

class IndividualQuestion extends Question {

    recordedAudio;

    constructor(data, part, index) {
        super(data, part, index);
        this.recordedAudio = null;
    }

    show() {
        super.show();
        this.part.test.mediaRecorder.start();
        super.onShow();
    }

    onComplete() {
        super.onComplete();
        const duration = ((this.answeredAt - this.displayedAt) / 1000).toFixed(1);
        this.part.test.send({
            event: "test.answered",
            message: `Elev har gennemført spørgsmål ${this.index + 1}`,
            choice: null,
            recordingBase64: this.recordedAudio,
            index: this.index,
            displayedAt: this.displayedAt,
            answeredAt: this.answeredAt,
            duration: duration
        });
        this.part.onQuestionComplete();
    }

    async teacherFeedback(outcome) {
        this.answeredAt = document.timeline.currentTime;
        this.recordedAudio = await this.part.test.mediaRecorder.interval();
        this.onComplete();
    }
}

class PossibleAnswer {

    question;
    question_type;
    id;
    resourceId;
    resourceName;
    resourceImageUrl;
    resourceSoundUrl;
    resourceText;
    isCorrect;
    button;

    constructor(data, question) {
        this.question = question;
        this.question_type = question.question_type;
        this.domElements = question.domElements;
        this.id = data.id;
        this.resourceId = data.resource_id;
        this.resourceName = data.resource_name;
        this.resourceImageUrl = data.resource_image_url;
        this.resourceSoundUrl = data.resource_sound_url;
        this.resourceText = data.resource_text;
        this.isCorrect = data.is_correct;
    }

    show() {
        if (this.question_type === "multiple_choice"){
            this.button = this.domElements.showQuestionChoice(this.resourceText, this.resourceSoundUrl, this.resourceImageUrl);
            this.button.addEventListener("click", () => this.select());
        } else if (this.question_type === "free_text"){
            this.input = this.domElements.showQuestionFreeText();
            this.input.addEventListener("input", () => this.selectFreeText());
        }
    }

    select() {
        this.question.select(this);
        this.button.classList.add("btn-primary");
        this.button.classList.remove("btn-outline-primary");
        for (let otherAnswer of this.question.possibleAnswers) {
            if (otherAnswer !== this) {
                otherAnswer.button.classList.add("btn-outline-primary");
                otherAnswer.button.classList.remove("btn-primary");
            }
        }
    }
    selectFreeText() {
        if (this.input.value.trim() !== "") {
            this.question.select(this);
        }
    }
}
