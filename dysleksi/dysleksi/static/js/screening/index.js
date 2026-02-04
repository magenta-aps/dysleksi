import { startSession } from "./utils.js";
import { getWebSocket } from "../ws.js";


document.addEventListener('DOMContentLoaded', async () => {
    const roleEl = document.querySelector("[data-role]");

    const role = roleEl.dataset.role;
    
    const testType = roleEl.dataset.testType
    let initStudent, initTeacher;

    if (testType === "individual") {
        ({ initStudent } = await import("./individual/student.js"));
        ({ initTeacher } = await import("./individual/teacher.js"));
    } else if (testType === "group") {
        ({ initStudent } = await import("./group/student.js"));
        ({ initTeacher } = await import("./group/teacher.js"));
    } else {
        throw new Error("Invalid test type '"+testType+"'");
    }
    
    const roomName = roleEl.dataset.roomName;
    const assignmentId = roleEl.dataset.assignmentId;
    const testContentsEl = document.getElementById("test_contents");
    const testContents = testContentsEl ? JSON.parse(testContentsEl.textContent) : null;

    if (role === "student") {
        initStudent(roomName, assignmentId, testContents);
    }
    if (role === "teacher") {
        initTeacher(roomName, assignmentId, testContents);
        startSession(roomName); 
    }
});
