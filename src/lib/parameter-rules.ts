export const FORMULA_MAX = 200;
export const PARAMETER_CONDITION_MAX = 8;

export const PARAMETER_CONDITIONS = [
    { code: "gt", label: "больше", symbol: ">" },
    { code: "gte", label: "не меньше", symbol: "≥" },
    { code: "lt", label: "меньше", symbol: "<" },
    { code: "lte", label: "не больше", symbol: "≤" },
    { code: "eq", label: "равно", symbol: "=" },
    { code: "neq", label: "не равно", symbol: "≠" },
] as const;

export type ConditionOperator = (typeof PARAMETER_CONDITIONS)[number]["code"];

export interface ParameterCondition {
    operator: ConditionOperator;
    sourceKey: string;
}

type FormulaNode =
    | { type: "number"; value: number }
    | { type: "ref"; key: string }
    | { type: "unary"; value: FormulaNode }
    | { type: "binary"; op: "+" | "-" | "*" | "/"; left: FormulaNode; right: FormulaNode };

type Token =
    | { type: "number"; value: number }
    | { type: "ident"; value: string }
    | { type: "op"; value: "+" | "-" | "*" | "/" }
    | { type: "lparen" }
    | { type: "rparen" };

export function conditionLabel(operator: ConditionOperator): string {
    return PARAMETER_CONDITIONS.find((item) => item.code === operator)?.label ?? operator;
}

export function isConditionOperator(value: unknown): value is ConditionOperator {
    return PARAMETER_CONDITIONS.some((item) => item.code === value);
}

export function parseFormula(source: string): { refs: string[] } | { error: string } {
    const tokens = tokenize(source);
    if ("error" in tokens) {
        return tokens;
    }
    const parsed = parseTokens(tokens);
    if ("error" in parsed) {
        return parsed;
    }
    return { refs: collectRefs(parsed) };
}

export function evaluateFormula(
    source: string,
    values: ReadonlyMap<string, number>,
): { value: number } | { error: string } | { pending: true } {
    const tokens = tokenize(source);
    if ("error" in tokens) {
        return tokens;
    }
    const parsed = parseTokens(tokens);
    if ("error" in parsed) {
        return parsed;
    }
    return evaluateNode(parsed, values);
}

export function compareCondition(left: number, operator: ConditionOperator, right: number): boolean {
    const normalizedLeft = normalizeNumber(left);
    const normalizedRight = normalizeNumber(right);
    switch (operator) {
        case "gt":
            return normalizedLeft > normalizedRight;
        case "gte":
            return normalizedLeft >= normalizedRight;
        case "lt":
            return normalizedLeft < normalizedRight;
        case "lte":
            return normalizedLeft <= normalizedRight;
        case "eq":
            return normalizedLeft === normalizedRight;
        case "neq":
            return normalizedLeft !== normalizedRight;
    }
}

export function formatCalculated(value: number): string {
    return String(normalizeNumber(value));
}

function normalizeNumber(value: number): number {
    const rounded = Math.round(value * 1e8) / 1e8;
    return Object.is(rounded, -0) ? 0 : rounded;
}

function collectRefs(node: FormulaNode): string[] {
    if (node.type === "ref") {
        return [node.key];
    }
    if (node.type === "unary") {
        return collectRefs(node.value);
    }
    if (node.type === "binary") {
        return [...collectRefs(node.left), ...collectRefs(node.right)];
    }
    return [];
}

function evaluateNode(
    node: FormulaNode,
    values: ReadonlyMap<string, number>,
): { value: number } | { error: string } | { pending: true } {
    if (node.type === "number") {
        return { value: node.value };
    }
    if (node.type === "ref") {
        const value = values.get(node.key);
        return value === undefined ? { pending: true } : { value };
    }
    if (node.type === "unary") {
        const inner = evaluateNode(node.value, values);
        if (!("value" in inner)) {
            return inner;
        }
        return finish(-inner.value);
    }
    const left = evaluateNode(node.left, values);
    if (!("value" in left)) {
        return left;
    }
    const right = evaluateNode(node.right, values);
    if (!("value" in right)) {
        return right;
    }
    if (node.op === "/" && right.value === 0) {
        return { error: "деление на ноль" };
    }
    const value = node.op === "+"
        ? left.value + right.value
        : node.op === "-"
            ? left.value - right.value
            : node.op === "*"
                ? left.value * right.value
                : left.value / right.value;
    return finish(value);
}

function finish(value: number): { value: number } | { error: string } {
    if (!Number.isFinite(value) || Math.abs(value) > 1e12) {
        return { error: "результат слишком большой" };
    }
    return { value: normalizeNumber(value) };
}

function tokenize(source: string): Token[] | { error: string } {
    const tokens: Token[] = [];
    let index = 0;
    while (index < source.length) {
        const char = source[index] ?? "";
        if (char === " " || char === "\n" || char === "\t") {
            index += 1;
            continue;
        }
        if (char === "(") {
            tokens.push({ type: "lparen" });
            index += 1;
            continue;
        }
        if (char === ")") {
            tokens.push({ type: "rparen" });
            index += 1;
            continue;
        }
        if (char === "+" || char === "-" || char === "*" || char === "/") {
            tokens.push({ type: "op", value: char });
            index += 1;
            continue;
        }
        if (char >= "0" && char <= "9") {
            const start = index;
            index += 1;
            while (index < source.length && source[index] >= "0" && source[index] <= "9") {
                index += 1;
            }
            if (source[index] === "." || source[index] === ",") {
                index += 1;
                const fraction = index;
                while (index < source.length && source[index] >= "0" && source[index] <= "9") {
                    index += 1;
                }
                if (index === fraction) {
                    return { error: "число записано неверно" };
                }
            }
            const value = Number(source.slice(start, index).replace(",", "."));
            if (!Number.isFinite(value) || Math.abs(value) > 1e12) {
                return { error: "число слишком большое" };
            }
            tokens.push({ type: "number", value });
            continue;
        }
        if (char >= "a" && char <= "z") {
            const start = index;
            index += 1;
            while (index < source.length && /[a-z0-9_]/.test(source[index] ?? "")) {
                index += 1;
            }
            tokens.push({ type: "ident", value: source.slice(start, index) });
            continue;
        }
        return { error: "допустимы числа, коды параметров, скобки и знаки + − * /" };
    }
    if (tokens.length === 0) {
        return { error: "формула пустая" };
    }
    return tokens;
}

function parseTokens(tokens: Token[]): FormulaNode | { error: string } {
    let position = 0;

    function peek(): Token | undefined {
        return tokens[position];
    }

    function isOperator(...operators: string[]): boolean {
        const token = peek();
        return token?.type === "op" && operators.includes(token.value);
    }

    function parseExpression(): FormulaNode | { error: string } {
        let left = parseTerm();
        if ("error" in left) {
            return left;
        }
        while (isOperator("+", "-")) {
            const operator = (tokens[position] as { value: "+" | "-" }).value;
            position += 1;
            const right = parseTerm();
            if ("error" in right) {
                return right;
            }
            left = { type: "binary", op: operator, left, right };
        }
        return left;
    }

    function parseTerm(): FormulaNode | { error: string } {
        let left = parseUnary();
        if ("error" in left) {
            return left;
        }
        while (isOperator("*", "/")) {
            const operator = (tokens[position] as { value: "*" | "/" }).value;
            position += 1;
            const right = parseUnary();
            if ("error" in right) {
                return right;
            }
            left = { type: "binary", op: operator, left, right };
        }
        return left;
    }

    function parseUnary(): FormulaNode | { error: string } {
        if (peek()?.type === "op" && (peek() as { value: string }).value === "-") {
            position += 1;
            const value = parseUnary();
            if ("error" in value) {
                return value;
            }
            return { type: "unary", value };
        }
        return parsePrimary();
    }

    function parsePrimary(): FormulaNode | { error: string } {
        const token = peek();
        if (!token) {
            return { error: "формула обрывается" };
        }
        if (token.type === "number") {
            position += 1;
            return { type: "number", value: token.value };
        }
        if (token.type === "ident") {
            position += 1;
            return { type: "ref", key: token.value };
        }
        if (token.type === "lparen") {
            position += 1;
            const inner = parseExpression();
            if ("error" in inner) {
                return inner;
            }
            if (peek()?.type !== "rparen") {
                return { error: "не закрыта скобка" };
            }
            position += 1;
            return inner;
        }
        return { error: "ожидалось число, параметр или скобка" };
    }

    const expression = parseExpression();
    if ("error" in expression) {
        return expression;
    }
    if (position !== tokens.length) {
        return { error: "формула записана неверно" };
    }
    return expression;
}
