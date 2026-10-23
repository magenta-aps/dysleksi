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

Possible question types are:
- `multiple_choice`
- `free_text`
- `no_input_required`
- `multiple_choice_match`
- `instruction_sequence_outro`

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