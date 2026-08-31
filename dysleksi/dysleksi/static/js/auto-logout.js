const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "scroll"];

const PING_INTERVAL_MS = 60000;

export class AutoLogout {
    constructor(config, pingIntervalMs = PING_INTERVAL_MS) {
        this.timeoutMs = config.timeout * 1000;
        this.pingUrl = config.ping_url;
        this.logoutUrl = config.logout_url;
        this.logoutOnIdle = config.logout_on_idle;
        this.pingIntervalMs = pingIntervalMs;
        this.activity = false;
        this.idleTimer = null;
        this.pingTimer = null;
    }

    start() {
        if (this.logoutOnIdle) {
            for (const event of ACTIVITY_EVENTS) {
                document.addEventListener(event, () => this.onActivity(), {
                    capture: true,
                    passive: true,
                });
            }
            this.restartIdleTimer();
        }
        this.pingTimer = setInterval(() => this.keepAlive(), this.pingIntervalMs);
    }

    onActivity() {
        this.activity = true;
        this.restartIdleTimer();
    }

    restartIdleTimer() {
        clearTimeout(this.idleTimer);
        this.idleTimer = setTimeout(() => this.logout(), this.timeoutMs);
    }

    keepAlive() {
        if (this.logoutOnIdle && !this.activity) {
            // Nothing happened since the last ping, so let the session expire
            return;
        }
        this.activity = false;
        this.ping();
    }

    async ping() {
        try {
            await fetch(this.pingUrl);
        } catch (error) {
            console.warn("Could not reach the server to renew the session:", error);
        }
    }

    logout() {
        clearInterval(this.pingTimer);
        window.location = this.logoutUrl;
    }
}

const configElement = document.getElementById("auto-logout-config");
if (configElement) {
    const config = JSON.parse(configElement.textContent);
    if (config.enabled) {
        new AutoLogout(config).start();
    }
}
