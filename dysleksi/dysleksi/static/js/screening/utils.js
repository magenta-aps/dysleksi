import { getWebSocket } from "../ws.js";

let wakeLock = null;

export function startSession(roomName) {
    const chatSocket = getWebSocket(roomName);

    chatSocket.addEventListener("open", () => {
        chatSocket.send(JSON.stringify({
            uuid: crypto.randomUUID(),
            event: "session.start",
            roomUrl: window.location.href.replace(window.location.origin, "")
        }));
    }, { once: true });

    chatSocket.addEventListener("message", (e) => {
        const data = JSON.parse(e.data);
        if (data.event === "student.ready") {
            refreshSession(roomName);
        }
    });

    return chatSocket;
}

export function refreshSession(roomName) {
    const chatSocket = getWebSocket(roomName);
    if (chatSocket.readyState === WebSocket.OPEN) {
        chatSocket.send(JSON.stringify({
            uuid: crypto.randomUUID(),
            event: "session.in_progress",
            roomUrl: window.location.href.replace(window.location.origin, "")
        }));
    } else {
        // queue the message until the socket opens
        chatSocket.addEventListener("open", () => sendSessionMessage(chatSocket), { once: true });
    }
}

export function shuffleArray(array) {
    const arr = [...array]; // do not mutate original
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

export async function requestWakeLock() {
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    console.log('Screen wake lock active');
    
    wakeLock.addEventListener('release', () => {
      console.log('Screen wake lock released');
    });
  } catch (err) {
    console.error(`${err.name}, ${err.message}`);
  }
}

export function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release();
    wakeLock = null;
  }
}
