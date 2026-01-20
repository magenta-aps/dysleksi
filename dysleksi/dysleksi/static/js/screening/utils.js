export function extractQuestions(testContents) {
    return testContents.parts.flatMap(part =>
        part.questions.map(q => ({
            partId: part.id,
            partName: part.name,
            questionId: q.id,
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
