import {EventTable, ActionButtons, TeacherView, NoteField} from "../controlroom.js";
import { getWebSocket } from "../../ws.js";

export function initTeacher(roomName, assignmentId, testContents) {
    const table = new EventTable();
    const buttons = new ActionButtons();
    const noteField = new NoteField();
    
    new TeacherView(roomName, testContents, assignmentId, getWebSocket, table, buttons, noteField);
}


