import { startSession } from "./utils.js";
import { Test, Student } from "./model.js";
import { WindowLock, showWindowBlockedMessage } from "./window-lock.js";

export async function start() {
    const roleEl = document.querySelector("[data-role]");

    const role = roleEl.dataset.role;

    const testType = roleEl.dataset.testType;
    let initStudent, initTeacher;

    const assignmentId = Number(roleEl.dataset.assignmentId);
    const testContentsEl = document.getElementById("test_contents");
    const testContents = testContentsEl ? JSON.parse(testContentsEl.textContent) : null;
    const studentIdsEl = document.getElementById("student_ids");
    const studentIds = studentIdsEl ? JSON.parse(studentIdsEl.textContent) : null;
    const test = new Test(testContents);

    const studentData = {};
    studentData.firstName = roleEl.dataset.studentFirstName;
    studentData.lastName = roleEl.dataset.studentLastName;
    studentData.id = Number(roleEl.dataset.studentId);

    const student = new Student(studentData);
    student.populateExistingAnswers(test);

    if (role === "student") {
        student.initializeMockData(test);
    }

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

    const lockConfig = JSON.parse(
        document.getElementById("window-lock-config").textContent,
    );
    const windowLock = new WindowLock(lockConfig.url, lockConfig.csrf_token);
    if (!(await windowLock.acquire())) {
        // Do not allow multiple active windows per test.
        showWindowBlockedMessage();
        return;
    }

    if (role === "student") {
        initStudent(assignmentId, test, student, testType);
    }
    if (role === "teacher") {
        initTeacher(assignmentId, test);
        startSession(studentIds, assignmentId);
    }
}

document.addEventListener("DOMContentLoaded", start);
