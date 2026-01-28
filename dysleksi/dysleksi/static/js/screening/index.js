import { startSession } from "./utils.js";
import { refreshSession } from "./utils.js";
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
    }
    
    const roomName = roleEl.dataset.roomName;
    const testContentsEl = document.getElementById("test_contents");
    const testContents = testContentsEl ? JSON.parse(testContentsEl.textContent) : null;

    if (role === "student") {
        initStudent(roomName, testContents);
    }
    if (role === "teacher") {
        if (testType === "individual") {
            initTeacher(roomName, testContents);  
        } else if (testType === "group") {
            initTeacher(roomName);  
        }
            
        startSession(roomName); 
        setInterval(() => {
            refreshSession(roomName);
        }, 1000);
    }
});
