// src/app/api/admin/available-routes/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Список строго технических роутов, которые не нужно выводить в UI
const BLACKLISTED_ROUTES = [
    '/',
    '/api/auth',
    '/auth',
    '/forbidden',
    '/unauthorized',
    '/error',
    '/_not-found'
];

function scanProjectRoutes(dirPath: string, baseAppPath: string, routesList: string[] = []): string[] {
    if (!fs.existsSync(dirPath)) return routesList;
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
        const fullPath = path.join(dirPath, file);
        const stat = fs.statSync(fullPath);

        // Игнорируем приватные папки и папки компонентов
        if (stat.isDirectory() && (file.startsWith('_') || file.startsWith('.'))) continue;

        if (stat.isDirectory()) {
            scanProjectRoutes(fullPath, baseAppPath, routesList);
        } else if (['route.ts', 'route.js', 'page.tsx', 'page.jsx', 'page.js'].includes(file)) {
            const relativePath = path.relative(baseAppPath, dirPath).replace(/\\/g, '/');
            const routeUrl = relativePath === '' ? '/' : `/${relativePath}`;

            // Проверяем, не входит ли роут или его начало в черный список
            const isBlacklisted = BLACKLISTED_ROUTES.some(b =>
                routeUrl === b || routeUrl.startsWith(`${b}/`)
            );

            if (!isBlacklisted && !routesList.includes(routeUrl)) {
                routesList.push(routeUrl);
            }
        }
    }
    return routesList;
}

export async function GET() {
    try {
        let baseAppPath = path.join(process.cwd(), 'src', 'app');
        if (!fs.existsSync(baseAppPath)) baseAppPath = path.join(process.cwd(), 'app');

        const scannedRoutes = scanProjectRoutes(baseAppPath, baseAppPath);

        const apiRoutes: string[] = [];
        const pageRoutes: string[] = [];

        scannedRoutes.forEach(route => {
            if (route.startsWith('/api')) {
                apiRoutes.push(route);
            } else {
                pageRoutes.push(route);
            }
        });

        return NextResponse.json({
            success: true,
            data: {
                pages: pageRoutes.sort(),
                api: apiRoutes.sort()
            }
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: { message: 'Ошибка сканирования' } }, { status: 500 });
    }
}
