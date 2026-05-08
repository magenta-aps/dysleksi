export class AssetCache {
    constructor() {
        this.map = new Map();
    }

    // Strip a content hash like ".6eca11d940e6" from before the extension
    // "/static/file.6eca11d940e6.png" -> "/static/file.png"
    // "/static/file.png" -> "/static/file.png" (unchanged)
    _stripHash(path) {
        return path.replace(/\.[a-f0-9]{8,}(\.[^./]+)$/i, "$1");
    }

    _lookup(path) {
        // Try exact match first
        if (this.map.has(path)) return this.map.get(path);

        // Strip hashes from map keys and check if there is a match
        for (const [key, value] of this.map.entries()) {
            if (this._stripHash(key) === path) {
                return value;
            }
        }
        return undefined;
    }

    fetch(url) {
        // Return a blob-URL given a static or media URL
        return this.map.get(url) || url;
    }

    reverseFetch(blobUrl) {
        // Return a human-readable static or media URL given a blob-URL
        for (let [originalUrl, cachedBlobUrl] of this.map.entries()) {
            if (cachedBlobUrl === blobUrl) {
                return originalUrl;
            }
        }
        return blobUrl;
    }

    async fetchAndCache(url) {
        // Creates a blob-url given a static or media URL, and returns it
        if (this.map.has(url)) return this.fetch(url);

        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        this.map.set(url, blobUrl);
        return blobUrl;
    }

    async processTestObject(obj, key) {
        // Creates a blob-url for a test-object URL and replaces the original URL
        const url = obj[key];
        if (!url) return;
        const result = await this.fetchAndCache(url);
        obj[key] = result; // Overwrite in-place
    }

    async processStaticFile(url) {
        // Creates a blob-url for a static URL and stores it in the cache
        await this.fetchAndCache(url);
    }

    async applyCssVariables() {
        // Updates CSS variables to use blobs instead of static-URLs
        const rootStyles = getComputedStyle(document.documentElement);
        const variablesFound = new Set();

        for (const sheet of document.styleSheets) {
            for (const rule of sheet.cssRules) {
                if (rule.selectorText === ":root" && rule.style) {
                    for (const prop of rule.style) {
                        if (prop.startsWith("--")) {
                            variablesFound.add(prop);
                        }
                    }
                }
            }
        }

        variablesFound.forEach((varName) => {
            let rawValue = rootStyles.getPropertyValue(varName).trim();

            // Extract the URL from url("...")
            const match = rawValue.match(/url\s*\(\s*['"]?([^'"]+)['"]?\s*\)/);
            if (match) {
                const fullUrl = match[1];

                // Convert absolute URL to relative path (e.g., /static/...)
                const path = new URL(fullUrl, window.location.origin).pathname;

                const blobUrl = this._lookup(path);
                if (!blobUrl) {
                    console.warn(`${path} is not in the map: `, this.map);
                } else {
                    document.documentElement.style.setProperty(
                        varName,
                        `url(${blobUrl})`,
                    );
                    console.log(`Successfully mapped ${varName} -> ${path}`);
                }
            }
        });
    }

    async applyCachedFonts() {
        for (let [originalPath, blobUrl] of this.map.entries()) {
            if (originalPath.endsWith(".ttf")) {
                // Derive a name from the path.
                // For example: "/fonts/OpenSans-Bold.ttf" -> "OpenSans-Bold"
                const fileName = originalPath.split("/").pop().split(".")[0];

                const fontFace = new FontFace(fileName, `url(${blobUrl})`, {
                    style: "normal",
                    weight: fileName.toLowerCase().includes("bold") ? "700" : "400",
                });

                const loadedFace = await fontFace.load();
                document.fonts.add(loadedFace);
                console.log(`Loaded ${fileName} font.`);
            }
        }
    }
}

export const assetCache = new AssetCache();
