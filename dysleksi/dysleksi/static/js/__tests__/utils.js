import { expect } from "vitest";

export function withAnyUUID(json) {
    // Cutoff leading and trailing curly braces,
    // escape so it will be recognized verbatim in a regex,
    // prepend uuid entry with regex match for any string (no quotes)
    // envelop in curly braces, put it in a regex,
    // envelop in expect.stringMatching

    // The result is that when comparing with this in
    // e.g. expect(func).toHaveBeenCalledWith(jsonstring),
    // the uuid in the call list can have any value
    return expect.stringMatching(
        new RegExp(
            "{\"uuid\":\"[^\"]+\"," +
            RegExp.escape(json.slice(1, -1)) +
            "}"
        )
    );
}
