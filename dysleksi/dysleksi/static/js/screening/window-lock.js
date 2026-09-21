// How often we tell the server that this window is still open.
const HEARTBEAT_MS = 5000;

export const WINDOW_BLOCKED_EVENT = "window-blocked";

export const showWindowBlockedMessage = () => {
    document.getElementById("window-blocked").classList.remove("d-none");
    document.dispatchEvent(new Event(WINDOW_BLOCKED_EVENT));
};

export class WindowLock {
    /* Makes sure that only one window at a time runs a test.

       The server decides whether to grant a lock. See WindowLockView in views.py */

    constructor(url, csrfToken) {
        this.url = url;
        this.csrfToken = csrfToken;
        this.windowId = crypto.randomUUID();
        this.heartbeat = null;
    }

    async acquire() {
        const granted = await this._post({ windowId: this.windowId, acquire: true });
        if (granted) {
            this._keepAlive();

            // Release the lock when a page is closed.
            // Note: This does not trigger in case the browser is closed entirely. Only
            // when a tab is closed. In case the browser is closed, we simply need to
            // wait for the cache to time out, before the lock is released (16 seconds).
            window.addEventListener("pagehide", () => {
                clearTimeout(this.heartbeat);
                this._post({ windowId: this.windowId, release: true });
            });
        }
        return granted;
    }

    _keepAlive() {
        // Each heartbeat is scheduled once the previous one has been answered, so a
        // server that has stopped answering does not leave requests piling up.
        this.heartbeat = setTimeout(async () => {
            if (await this._post({ windowId: this.windowId })) {
                this._keepAlive();
            } else {
                // We lost the lock, so another window is running the test now
                showWindowBlockedMessage();
            }
        }, HEARTBEAT_MS);
    }

    async _post(body) {
        let response;
        try {
            response = await fetch(this.url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": this.csrfToken,
                },
                body: JSON.stringify(body),
                keepalive: true,
                signal: AbortSignal.timeout(HEARTBEAT_MS),
            });
        } catch (error) {
            console.warn("Could not reach the window lock:", error);
            return true;
        }
        if (!response.ok) {
            console.warn(`Window lock answered ${response.status}`);
            return true;
        }
        return (await response.json()).granted;
    }
}
