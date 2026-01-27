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

export function shuffleArray(array) {
    const arr = [...array]; // do not mutate original
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
