### JSON Instructions

This folder contains instruction-json-files. A JSON file contains all information needed
to import tests in the database:
- Questions
- Practice questions
- Instruction sequences

JSON files are imported into the database using the `update_or_create_tests` management
command. This command runs automatically when the container is started.

## Questions

The JSON format for a question needs to contain a question type, correct answer,
wrong answer as well as the question challenge, which can be text, an image or a sound
file.

For example:

```
{
    "image": "resources/wordreading_2/Opgave/3-_Skur.jpg",
    "question_type": "multiple_choice",
    "wrong": [
        "qulleq",
        "qisuk",
        "qajaq"
    ],
    "correct": "qui",
    "correct_index": 2
}
```

A question without a wrong answer, such as a question in a questionnaire, lists its
answers as `options` instead. Every option counts as a correct answer:

```
{
    "text": "Atuarsinnaanngornissat sapernartittarpiuk?",
    "question_type": "multiple_choice",
    "text_da": "Har du svært ved at lære at læse?",
    "options": ["Qaqutikkut / Immannguaq", "Ilaannikkut", "Tamatigut / Annertuumik"],
    "options_da": ["Sjældent / lidt", "Nogle gange", "Altid / en stor del"],
    "is_questionnaire": true
}
```

`text_da` and `options_da` are shown to a test leader who has chosen Danish. The test
person always sees `text` and `options`.

Options listed in `locked_options` are shown disabled and cannot be chosen.

With `writing_guidance`, a `free_text` question shows its correct answer in grey. The
student can only write the letters of the answer, and the "next" button appears once the
answer is written.

With `is_questionnaire`, any answer counts as correct. The student only sees the
question, and the test leader chooses the answer in the control room. This is used in
the dyslexia test.

With `allow_replaying_instruction_sequence`, a speaker button appears in the upper
left corner once the instruction sequence has finished. Pressing it shows the question
again and replays the instruction sequence.

By default, the challenge sound plays once the instruction sequence has finished, if the
student has to answer the question. Set `play_sound_when_instruction_is_complete` to
`false` when the instruction sequence already plays the sound.

By default, a correct answer to a practice question turns green and plays a sound. Set
`confirm_correct_answer` to `false` to move on without that.

Possible question types are:
- `multiple_choice`
- `free_text`
- `no_input_required`
- `multiple_choice_match`
- `instruction_sequence_outro`
- `dyslexia_instruction_sequence_outro`

`instruction_sequence_outro` is the last question of a practice file. It explains the
blue "next" and grey "repeat" buttons and only needs five sound files. It is imported as
a `no_input_required` question with a fixed instruction sequence (see
`TestPart.instruction_sequence_outro`):

```
{
    "question_type": "instruction_sequence_outro",
    "sounds": [
        "resources/.../done.mp3",
        "resources/.../two_options.mp3",
        "resources/.../blue.mp3",
        "resources/.../grey.mp3",
        "resources/.../choose.mp3"
    ]
}
```

`dyslexia_instruction_sequence_outro` follows the examples of a part of the dyslexia
test. It shows the "repeat" and "next" buttons, and tells that the examples can be
seen again (see `TestPart.dyslexia_instruction_sequence_outro`). With `start_test`,
it also tells that "next" starts the test, for a part without practice questions:

```
{
    "question_type": "dyslexia_instruction_sequence_outro",
    "start_test": true
}
```

## Practice questions

A practice question is the same as a normal question, except it is in the 
`_pracice.json` file for a particular test

## Instruction sequences

An instruction sequence is a sequence of actions which should play before a quesion
can be interacted with. For example:

```
  {
    "question_type": "no_input_required",
    "image": "/resources/nonsense_word_pronunciation/nonsense_word_pronunciation.png",
    "instruction_sequence": [
      {
        "action": "hide",
        "element": "next",
        "delayAfter": 0
      },
      {
        "action": "playSound",
        "resource": "resources/nonsense_word_pronunciation/Enhanced/Indledning/11a.1.mp3",
        "delayAfter": 0
      },
      {
        "action": "show",
        "element": "question-challenge",
        "delayAfter": 0
      },
      {
        "action": "playSound",
        "resource": "resources/nonsense_word_pronunciation/Enhanced/Indledning/11a.3.mp3",
        "delayAfter": 1250
      },
      {
        "action": "show",
        "element": "next",
        "delayAfter": 0
      }
    ]
  },
```

Which does the following:
- Make sure the next button is hidden (The element with the id `next`)
- Play `11a.1.mp3`
- Show the question challenge (the element with the id `question-challenge`)
- Play `11a.3.mp3`
- Wait 1250 milliseconds
- Show the "next" button


Apart from `show`, `hide` and `playSound` there are more actions.
The available "actions" are listed in the `executeInstruction` method in
`instruction.js`.