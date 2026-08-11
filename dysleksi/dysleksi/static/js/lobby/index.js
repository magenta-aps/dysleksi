import { initRedirectSocket } from "./student.js";

const el = document.querySelector("[data-student-id]");

initRedirectSocket(Number(el.dataset.studentId));
