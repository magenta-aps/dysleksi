export class Test extends EventTarget {

    name;
    parts;
    currentPart;
    partIndex;

    constructor(data) {
        super()
        this.name = data.name;
        this.partIndex = 0;
        this.currentPart = null;
        this.summary = data.summary;
        this.summaryText = data.summary_text;
        const partClass = this.getPartClass();
        this.parts = data.parts.map((dataItem, index) => new partClass(dataItem, this, index));
        if (this.parts.length === 0) {
            throw new Error("Test has no parts");
        }
    }

    getPartClass() {
        return TestPart;
    }

}


export class TestPart {

    test;
    id;
    index;
    name;
    instructionsUrl;
    intro;
    timeout;
    partialScoreAfter;
    questions;
    practice;
    questionIndex;
    currentQuestion;

    constructor(data, test, index) {
        this.test = test;
        this.index = index;
        this.id = data.id;
        this.name = data.name;
        this.instructionsUrl = data.instructions_url;
        this.intro = data.intro;
        this.timeout = data.timeout;
        this.partialScoreAfter = data.partial_score_after;
        this.questionIndex = 0;
        this.currentQuestion = null;
        const questionClass = this.getQuestionClass();
        this.questions = data.questions.map((dataItem, index) => new questionClass(dataItem, this, index));
        if (data.practice !== undefined) {
            this.practice = data.practice.map((dataItem, index) => new questionClass(dataItem, this, index));
        } else {
            this.practice = [];
        }
    }

    getQuestionClass() {
        return Question;
    }

}


export class Question {

    part;
    id;
    type;
    index;
    challengeId;
    challengeName;
    challengeImageUrl;
    challengeSoundUrl;
    challengeText;
    possibleAnswers;
    displayedAt;
    answeredAt;
    domElements;
    instruction_sequence;
    reminder;
    timeout;

    constructor(data, part, index) {
        this.part = part;
        this.index = index;
        this.domElements = part.domElements;
        this.type = data.question_type;
        this.id = data.id;
        this.challengeId = data.challenge_id;
        this.challengeName = data.challenge_name;
        this.challengeImageUrl = data.challenge_image_url;
        this.challengeSoundUrl = data.challenge_sound_url;
        this.challengeText = data.challenge_text;
        const answerClass = this.getAnswerClass();
        this.possibleAnswers = data.possible_answers.map(dataItem => new answerClass(dataItem, this));
        this.instruction_sequence = data.instruction_sequence;
        this.reminder = data.reminder;
        this.timeout = data.timeout;
    }

    getAnswerClass() {
        return PossibleAnswer;
    }

}


export class PossibleAnswer {

    question;
    questionType;
    id;
    resourceId;
    resourceName;
    resourceImageUrl;
    resourceSoundUrl;
    resourceText;
    isCorrect;
    button;
    textAnswer;

    constructor(data, question) {
        this.question = question;
        this.questionType = question.type;
        this.domElements = question.domElements;
        this.id = data.id;
        this.resourceId = data.resource_id;
        this.resourceName = data.resource_name;
        this.resourceImageUrl = data.resource_image_url;
        this.resourceSoundUrl = data.resource_sound_url;
        this.resourceText = data.resource_text;
        this.isCorrect = data.is_correct;
        this.textAnswer = null;
    }

}
