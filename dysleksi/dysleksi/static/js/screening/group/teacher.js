import {EventTable, ActionButtons, TeacherView, NoteField, QuestionView} from "../controlroom.js";
import { getWebSocket } from "../../ws.js";

export function initTeacher(roomName, assignmentId, test) {
    const table = new EventTable();
    const buttons = new ActionButtons();
    const noteField = new NoteField();
    const questionView = new QuestionView();

    new TeacherView(roomName, test, assignmentId, getWebSocket, table, buttons, noteField, questionView);
}


