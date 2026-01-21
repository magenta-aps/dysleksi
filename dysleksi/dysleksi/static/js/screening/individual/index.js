import { initStudent } from "./student.js";
import { initTeacher } from "./teacher.js";

document.addEventListener('DOMContentLoaded', () => {
    const roleEl = document.querySelector("[data-role]");

    const role = roleEl.dataset.role;
    const roomName = roleEl.dataset.roomName;

    const testContentsEl = document.getElementById("test_contents");
    const testContents = testContentsEl ? JSON.parse(testContentsEl.textContent) : null;

    if (role === "student") {
        initStudent(roomName, testContents);
    }
    if (role === "teacher") {
        initTeacher(roomName, testContents);
    }
});
