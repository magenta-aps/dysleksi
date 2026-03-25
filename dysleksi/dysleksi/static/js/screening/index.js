import { startSession } from "./utils.js";
import { Test, Student } from "./model.js";

export async function start() {
    const roleEl = document.querySelector("[data-role]");

    const role = roleEl.dataset.role;

    const testType = roleEl.dataset.testType;
    let initStudent, initTeacher;

    const roomName = roleEl.dataset.roomName;
    const assignmentId = roleEl.dataset.assignmentId;
    const testContentsEl = document.getElementById("test_contents");
    const testContents = testContentsEl ? JSON.parse(testContentsEl.textContent) : null;
    const test = new Test(testContents);

    const studentData = {};
    studentData.firstName = roleEl.dataset.studentFirstName;
    studentData.lastName = roleEl.dataset.studentLastName;
    studentData.id = roleEl.dataset.studentId;

    const student = new Student(studentData);

    if (testType === "individual") {
        if (role === "student") {
            ({ initStudent } = await import("./individual/student.js"));
        }
        if (role === "teacher") {
            ({ initTeacher } = await import("./individual/teacher.js"));
        }
    } else if (testType === "group") {
        if (role === "student") {
            ({ initStudent } = await import("./group/student.js"));
        }
        if (role === "teacher") {
            ({ initTeacher } = await import("./group/teacher.js"));
        }
    } else {
        throw new Error("Invalid test type '" + testType + "'");
    }

    if (role === "student") {
        initStudent(roomName, assignmentId, test, student, testType);
    }
    if (role === "teacher") {
        initTeacher(roomName, assignmentId, test);
        startSession(roomName);
    }
}

document.addEventListener("DOMContentLoaded", start);
