import { initStudentLobby } from "./student.js";

const el = document.querySelector("[data-individual-room-name]");

initStudentLobby({
    individualRoomName: el.dataset.individualRoomName,
    classRoomName: el.dataset.classRoomName,
});


