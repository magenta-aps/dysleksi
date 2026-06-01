import { initStudentLobby } from "./student.js";

const el = document.querySelector("[data-student-id]");

initStudentLobby(
    Number(el.dataset.studentId),
    el.dataset.hasOpenAssignments === "true",
);
