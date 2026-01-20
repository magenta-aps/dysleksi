import { initStudent } from "./student.js";
import { initTeacher } from "./teacher.js";

document.addEventListener('DOMContentLoaded', () => {
    const roleEl = document.querySelector("[data-role]");

    const role = roleEl.dataset.role;
    const roomName = roleEl.dataset.roomName;

    const tests = [
        {
            'type': 'multiple-choice',
            'question': 'Hvilket bogstav starter "kaffe" med?',
            'choices': ['A', 'B', 'K', 'L'],
        },
        {
            'type': 'multiple-choice',
            'question': 'Hvad kommer efter bogstavet "M"?',
            'choices': ['Q', 'N', 'S', 'E'],
        },
        {
            'type': 'audio-recording',
            'question': 'S',
        },
    ];

    if (role === "student") {
        initStudent(roomName, tests);
    }
    if (role === "teacher") {
        initTeacher(roomName, tests);
    }
});
