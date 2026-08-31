const { chromium } = require('playwright');
const WS_PATH = '/ws/chat/lobby/';
const students = Array.from({ length: 5 }, (_, i) => ({
    user: `elev${i}`,
    pass: `elev${i}`
}));

(async () => {
    const browser = await chromium.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    console.log(`Logging ${students.length} students in.`);

    for (const student of students) {
        (async () => {
            try {
                const context = await browser.newContext({
                    ignoreHTTPSErrors: true
                });
                const lobby = await context.newPage();
                lobby.on('console', msg => console.log(`BROWSER LOG [${student.user}/lobby]: ${msg.text()}`));
                lobby.on('pageerror', err => console.log(`BROWSER ERROR [${student.user}/lobby]: ${err.message}`));
                console.log(`Logging in as ${student.user}...`);
                await lobby.goto('https://dysleksi-web/login/forward/django?next=/');
                await lobby.waitForSelector('input[name="auth-username"]', { timeout: 10000 });
                await lobby.fill('input[name="auth-username"]', student.user);
                await lobby.fill('input[name="auth-password"]', student.pass);
                await Promise.all([
                    lobby.waitForNavigation(),
                    lobby.click('button[type="submit"]')
                ]);
                await lobby.waitForSelector('[data-student-id]');
                const studentId = Number(
                    await lobby.getAttribute('[data-student-id]', 'data-student-id')
                );
                console.log(`[OK] ${student.user} (id ${studentId}) entered the lobby.`);

                // Track room tabs so the same session.start (or a replay)
                // doesn't open duplicates
                const roomTabs = new Map();  // roomUrl -> Page

                // Node-side callback, invoked from inside the lobby page
                // every time a matching session.start arrives
                await lobby.exposeFunction('onSessionStart', async (roomUrl) => {
                    // Close all existing room tabs
                    for (const [url, page] of roomTabs) {
                        try {
                            await page.close();
                        } catch (_) {console.log("Error while closing page", _)}
                        roomTabs.delete(url);
                    }
                    try {
                        console.log(`[SESSION] ${student.user} got session.start, opening tab for ${roomUrl}`);
                        const room = await context.newPage();
                        roomTabs.set(roomUrl, room);
                        room.on('console', msg => console.log(`BROWSER LOG [${student.user}/room]: ${msg.text()}`));
                        room.on('pageerror', err => console.log(`BROWSER ERROR [${student.user}/room]: ${err.message}`));
                        room.on('close', () => roomTabs.delete(roomUrl));
                        await room.goto(new URL(roomUrl, lobby.url()).href);
                        console.log(`[ROOM] ${student.user} room tab is at ${room.url()}`);
                    } catch (err) {
                        roomTabs.delete(roomUrl);
                        console.error(`[ERROR] ${student.user} failed to open ${roomUrl}:`, err.message);
                    }
                });

                // Inject the permanent listener socket into the lobby page.
                // It never navigates, so this survives for the whole run.
                await lobby.evaluate(
                    ({ wsPath, studentId }) => {
                        const connect = () => {
                            const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
                            const ws = new WebSocket(`${proto}//${location.host}${wsPath}`);
                            ws.onmessage = (e) => {
                                let msg;
                                try { msg = JSON.parse(e.data); } catch { return; }
                                if (msg.event === 'session.start'
                                        && msg.studentIds?.includes(studentId)) {
                                    window.onSessionStart(msg.roomUrl);
                                }
                            };
                            // Reconnect if the socket drops
                            ws.onclose = () => setTimeout(connect, 2000);
                        };
                        connect();
                    },
                    { wsPath: WS_PATH, studentId }
                );

                console.log(`[LISTEN] ${student.user} is listening for sessions.`);
            } catch (err) {
                console.error(`[ERROR] Error for ${student.user}:`, err.message);
            }
        })();

        // Wait 500ms before starting the next bot to be gentle on the CPU
        await new Promise(r => setTimeout(r, 500));
    }
})();