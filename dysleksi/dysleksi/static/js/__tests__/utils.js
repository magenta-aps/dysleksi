import { vi } from "vitest";

const visited = new Set();
export function spyAttributes(targetItem, omitkeys = []) {
    // Avoid infinite recursion caused by circular references
    if (visited.has(targetItem)) return;
    visited.add(targetItem);

    // Get all properties of the object and its prototype chain
    const props = [];
    if (!omitkeys.includes("__proto__")) {
        omitkeys.push("__proto__");
    }
    let obj = targetItem;
    do {
        props.push(...Object.getOwnPropertyNames(obj));
    } while ((obj = Object.getPrototypeOf(obj)));

    // Spy on all functions and list items
    for (let attributeName of props) {
        if (omitkeys.includes(attributeName)) continue;
        let attribute = targetItem[attributeName];
        if (typeof attribute === "function") {
            vi.spyOn(targetItem, attributeName);
        } else if (
            typeof attribute === "object" &&
            attribute !== undefined &&
            attribute !== null
        ) {
            if (Array.isArray(attribute)) {
                for (let i = 0; i < attribute.length; i++) {
                    spyAttributes(attribute[i], omitkeys);
                }
            } else {
                // spyAttributes(attribute, omitkeys);
            }
        }
    }
}
