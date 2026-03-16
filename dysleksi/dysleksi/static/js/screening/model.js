import { assetCache } from "./cache.js";

export class Student {
    id;
    firstName;
    lastName;

    constructor(data) {
        this.id = data.id;
        this.firstName = data.firstName;
        this.lastName = data.lastName;
        this.progress = 0;
        this.results = [];
    }
    get displayName() {
        const lastInitial = this.lastName ? ` ${this.lastName[0].toUpperCase()}.` : "";
        return `${this.firstName}${lastInitial}`;
    }

    addResult(isCorrect) {
        this.results.push(isCorrect);
    }

}

export class Test extends EventTarget {

    name;
    testType;
    parts;
    currentPart;
    partIndex;

    constructor(data) {
        super()
        this.name = data.name;
        this.testType = data.test_type;
        this.partIndex = 0;
        this.currentPart = null;
        this.summary = data.summary;
        const partClass = this.getPartClass();
        this.parts = data.parts.map((dataItem, index) => new partClass(dataItem, this, index));
        if (this.parts.length === 0) {
            throw new Error("Test has no parts");
        }
        this.preload()
    }

    getPartClass() {
        return TestPart;
    }

    async preload() {
        console.log("Starting Asset preloading...");

        const staticFilesEl = document.getElementById("static_files");
        const staticFiles = JSON.parse(staticFilesEl.textContent);
        const tasks = [];

        // Queue Static Files
        staticFiles.forEach(url => {
            tasks.push(assetCache.processStaticFile(url));
        });

        // Queue Test Content
        for (const part of this.parts) {
            tasks.push(assetCache.processTestObject(part, 'image'));
            tasks.push(assetCache.processTestObject(part, 'instructionsUrl'));

            const allQuestions = [...part.questions, ...part.practice];
            for (const q of allQuestions) {
                tasks.push(assetCache.processTestObject(q, 'challengeImageUrl'));
                tasks.push(assetCache.processTestObject(q, 'challengeSoundUrl'));

                for (const a of q.possibleAnswers) {
                    tasks.push(assetCache.processTestObject(a, 'resourceImageUrl'));
                    tasks.push(assetCache.processTestObject(a, 'resourceSoundUrl'));
                }

                for (const inst of q.instruction_sequence?.instructions || []) {
                    tasks.push(assetCache.processTestObject(inst, 'url'));
                }
            }
        }

        // Execute all downloads in parallel
        await Promise.all(tasks);

        // Update variables and fonts with blob-urls
        assetCache.applyCssVariables();
        assetCache.applyCachedFonts();

        console.log("Preloading successful.");

        return assetCache.map;
    }
}


export class TestPart {

    test;
    id;
    index;
    name;
    image;
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
        this.image = data.image;
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
    reminderSource;
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
        this.reminderSource = data.reminderSource;
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
        this.buttonId = "choice-" + this.resourceText;
    }

}
