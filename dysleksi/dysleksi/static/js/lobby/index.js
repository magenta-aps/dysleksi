import { initStudentLobby } from "./student.js";
import { initTeacherLobby } from "./teacher.js";

const el = document.querySelector("[data-lobby-role]");

const role = el.dataset.lobbyRole;

if (role === "student") {
    initStudentLobby({
        individualRoomName: el.dataset.individualRoomName,
        classRoomName: el.dataset.classRoomName,
        individualRoomUrl: el.dataset.individualRoomUrl,
        classRoomUrl: el.dataset.classRoomUrl,
    });
}

if (role === "teacher") {
    initTeacherLobby();
}
