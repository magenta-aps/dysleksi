const { chromium } = require('playwright');

const students = Array.from({ length: 4 }, (_, i) => ({
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
                const page = await context.newPage();
                page.on('console', msg => console.log(`BROWSER LOG [${student.user}]: ${msg.text()}`));
                page.on('pageerror', err => console.log(`BROWSER ERROR [${student.user}]: ${err.message}`));
                
                console.log(`Logging in as ${student.user}...`);
                await page.goto('https://dysleksi-web/login?next=/');
                
                const userField = 'input[name="auth-username"]';
                const passField = 'input[name="auth-password"]';

                await page.waitForSelector(userField, { timeout: 10000 });
                
                await page.fill(userField, student.user);
                await page.fill(passField, student.pass);
                
                await Promise.all([
                    page.waitForNavigation(), 
                    page.click('button[type="submit"]')
                ]);

                await page.waitForSelector('.container');
                console.log(`✅ ${student.user} entered the lobby.`);

                // Give the websocket a chance to send student.ready
                await page.waitForTimeout(5000);

                // Keep connection alive for 1 hour
                await page.waitForTimeout(3600000); 

            } catch (err) {
                console.error(`❌ Error for ${student.user}:`, err.message);
            }
        })();

        // Wait 500ms before starting the next bot to be gentle on the CPU
        await new Promise(r => setTimeout(r, 500));
    }
})();