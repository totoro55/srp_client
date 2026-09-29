import { promises as fs } from "fs";
import path from "path";
import type { DiscoveredAppRoutes } from "@/types/api";

export type { DiscoveredAppRoutes };

const PAGE_FILE_NAMES = new Set([
    "page.tsx",
    "page.ts",
    "page.jsx",
    "page.js",
    "route.ts",
    "route.js",
]);

const BLACKLIST_EXACT = new Set([
    "/login",
    "/forbidden",
    "/unauthorized",
    "/error",
    "/_not-found",
]);

const BLACKLIST_PREFIXES = ["/api/auth", "/auth"];

function isBlacklisted(route: string): boolean {
    if (BLACKLIST_EXACT.has(route)) {
        return true;
    }
    return BLACKLIST_PREFIXES.some((prefix) => route === prefix || route.startsWith(`${prefix}/`));
}

function normalizeUrl(raw: string): string {
    let url = raw.replace(/\\/g, "/");
    if (!url.startsWith("/")) {
        url = `/${url}`;
    }
    if (url.length > 1 && url.endsWith("/")) {
        url = url.slice(0, -1);
    }
    return url === "" ? "/" : url;
}

function convertDynamicSegments(url: string): string {
    const converted = url
        .split("/")
        .map((segment) => {
            if (segment.startsWith("[[...") || segment.startsWith("[...")) {
                return "*";
            }
            if (segment.startsWith("[") && segment.endsWith("]")) {
                return "*";
            }
            return segment;
        })
        .join("/");

    return normalizeUrl(converted);
}

function stripPageOrRouteSuffix(url: string): string {
    if (url.endsWith("/page")) {
        return url.slice(0, -"/page".length) || "/";
    }
    if (url.endsWith("/route")) {
        return url.slice(0, -"/route".length) || "/";
    }
    return url || "/";
}

function looksLikeCompiledFile(value: string): boolean {
    return /\.(js|jsx|ts|tsx|mjs|cjs)$/i.test(value);
}

function routeFromManifestKey(key: string): string | null {
    const normalized = normalizeUrl(key);
    if (!normalized.endsWith("/page") && !normalized.endsWith("/route")) {
        return null;
    }
    return convertDynamicSegments(stripPageOrRouteSuffix(normalized));
}

export function collectRoutesFromManifest(record: Record<string, string>): string[] {
    const urls = new Set<string>();

    for (const [key, value] of Object.entries(record)) {
        if (typeof value === "string" && value.startsWith("/") && !looksLikeCompiledFile(value)) {
            urls.add(convertDynamicSegments(stripPageOrRouteSuffix(normalizeUrl(value))));
            continue;
        }

        const fromKey = routeFromManifestKey(key);
        if (fromKey) {
            urls.add(fromKey);
        }
    }

    return [...urls].filter((route) => !isBlacklisted(route));
}

function splitPagesAndApi(routes: string[]): Pick<DiscoveredAppRoutes, "pages" | "api"> {
    const unique = [...new Set(routes)];
    const pages: string[] = [];
    const api: string[] = [];

    for (const route of unique) {
        if (route.startsWith("/api")) {
            api.push(route);
        } else {
            pages.push(route);
        }
    }

    pages.sort();
    api.sort();
    return { pages, api };
}

async function readJsonRecord(filePath: string): Promise<Record<string, string> | null> {
    try {
        const raw = await fs.readFile(filePath, "utf8");
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed as Record<string, string>;
        }
        return null;
    } catch {
        return null;
    }
}

function manifestCandidates(): string[] {
    const cwd = process.cwd();
    return [
        path.join(cwd, ".next", "app-path-routes-manifest.json"),
        path.join(cwd, ".next", "server", "app-paths-manifest.json"),
        path.join(cwd, ".next", "standalone", ".next", "app-path-routes-manifest.json"),
        path.join(cwd, "app-path-routes-manifest.json"),
    ];
}

function filesystemAppRoots(): string[] {
    const cwd = process.cwd();
    return [path.join(cwd, "src", "app"), path.join(cwd, "app")];
}

function isRouteGroupSegment(segment: string): boolean {
    return segment.startsWith("(") && segment.endsWith(")");
}

function isPrivateOrParallelSegment(segment: string): boolean {
    return segment.startsWith("_") || segment.startsWith(".") || segment.startsWith("@");
}

async function scanFilesystemRoutes(
    dirPath: string,
    appRoot: string,
    acc: string[]
): Promise<string[]> {
    let entries: Awaited<ReturnType<typeof fs.readdir>>;
    try {
        entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
        return acc;
    }

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
            if (isPrivateOrParallelSegment(entry.name)) {
                continue;
            }
            await scanFilesystemRoutes(fullPath, appRoot, acc);
            continue;
        }

        if (!PAGE_FILE_NAMES.has(entry.name)) {
            continue;
        }

        const relativePath = path.relative(appRoot, dirPath).replace(/\\/g, "/");
        const segments = relativePath
            .split("/")
            .filter((segment) => segment.length > 0 && !isRouteGroupSegment(segment));
        const routeUrl = convertDynamicSegments(segments.length === 0 ? "/" : `/${segments.join("/")}`);

        if (!isBlacklisted(routeUrl) && !acc.includes(routeUrl)) {
            acc.push(routeUrl);
        }
    }

    return acc;
}

async function collectFromRoutesManifest(filePath: string): Promise<string[] | null> {
    try {
        const raw = await fs.readFile(filePath, "utf8");
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") {
            return null;
        }

        const manifest = parsed as {
            staticRoutes?: Array<{ page?: string }>;
            dynamicRoutes?: Array<{ page?: string }>;
        };
        const pages = [
            ...(manifest.staticRoutes ?? []),
            ...(manifest.dynamicRoutes ?? []),
        ]
            .map((entry) => entry.page)
            .filter((page): page is string => typeof page === "string" && page.startsWith("/"))
            .map((page) => convertDynamicSegments(normalizeUrl(page)))
            .filter((route) => !isBlacklisted(route));

        return pages.length > 0 ? pages : null;
    } catch {
        return null;
    }
}

export async function discoverAppRoutes(): Promise<DiscoveredAppRoutes> {
    for (const candidate of manifestCandidates()) {
        const record = await readJsonRecord(candidate);
        if (!record) {
            continue;
        }
        const collected = collectRoutesFromManifest(record);
        if (collected.length > 0) {
            return { ...splitPagesAndApi(collected), source: "manifest" };
        }
    }

    const routesManifestPaths = [
        path.join(process.cwd(), ".next", "routes-manifest.json"),
        path.join(process.cwd(), ".next", "standalone", ".next", "routes-manifest.json"),
    ];
    for (const candidate of routesManifestPaths) {
        const collected = await collectFromRoutesManifest(candidate);
        if (collected && collected.length > 0) {
            return { ...splitPagesAndApi(collected), source: "manifest" };
        }
    }

    const scanned: string[] = [];
    for (const appRoot of filesystemAppRoots()) {
        try {
            await fs.access(appRoot);
        } catch {
            continue;
        }
        await scanFilesystemRoutes(appRoot, appRoot, scanned);
        break;
    }

    return { ...splitPagesAndApi(scanned), source: "filesystem" };
}
