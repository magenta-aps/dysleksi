import { EventTable, ActionButtons, TeacherView } from "../controlroom.js";
import { getWebSocket } from "../../ws.js";

export function initTeacher(roomName, testContents) {

    const table = new EventTable();
    const buttons = new ActionButtons();
    buttons.showButtons()

    new TeacherView(roomName, testContents, getWebSocket, table, buttons);
}
