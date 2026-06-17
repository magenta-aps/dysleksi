export function gettext(msgid) {
    // Use this function like you use gettext from django.utils.translate:
    //
    // const job = gettext("Udvikler")
    if (typeof globalThis.gettext === "function") {
        return globalThis.gettext(msgid);
    }
    return msgid;
}

export function blocktranslate(fmt, params) {
    // Use this function like you use blocktranslate in HTML templates:
    //
    // const name = blocktranslate(gettext("Mit navn er %(name)s"), {name: "Fred"})
    if (typeof globalThis.interpolate === "function") {
        return globalThis.interpolate(fmt, params, true);
    }
    return fmt.replace(/%\(\w+\)s/g, (match) => String(params[match.slice(2, -2)]));
}
