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

    async _removeWhiteBackground(blob, threshold = 30) {
        const bitmap = await createImageBitmap(blob);
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(bitmap, 0, 0);

        const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i],
                g = data[i + 1],
                b = data[i + 2];
            if (r > 255 - threshold && g > 255 - threshold && b > 255 - threshold) {
                data[i + 3] = 0;
            }
        }
        ctx.putImageData(imageData, 0, 0);
        return canvas.convertToBlob({ type: "image/png" });
    }

    async fetchAndCache(url, removeWhiteBg = false) {
        // Creates a blob-url given a static or media URL, and returns it
        if (this.map.has(url)) return this.fetch(url);

        const response = await fetch(url);
        let blob = await response.blob();

        if (removeWhiteBg) {
            blob = await this._removeWhiteBackground(blob);
        }

        const blobUrl = URL.createObjectURL(blob);
        this.map.set(url, blobUrl);
        return blobUrl;
    }

    async processTestObject(obj, key, removeWhiteBg = false) {
        // Creates a blob-url for a test-object URL and replaces the original URL
        const url = obj[key];
        if (!url) return;
        const result = await this.fetchAndCache(url, removeWhiteBg);
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
