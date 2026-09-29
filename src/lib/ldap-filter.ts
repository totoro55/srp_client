/**
 * RFC 4515: экранирование значения внутри LDAP-фильтра.
 */
export function escapeLdapFilterValue(value: string): string {
    let escaped = "";

    for (const char of value) {
        const code = char.charCodeAt(0);
        if (
            char === "*" ||
            char === "(" ||
            char === ")" ||
            char === "\\" ||
            char === "/" ||
            code === 0
        ) {
            escaped += `\\${code.toString(16).padStart(2, "0")}`;
        } else {
            escaped += char;
        }
    }

    return escaped;
}
