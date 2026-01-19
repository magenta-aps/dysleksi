import { getWebSocket } from "../ws.js";

export function getLobbySocket() {
    return getWebSocket("lobby");
}
