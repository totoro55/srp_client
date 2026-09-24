// src/services/db.ts
import { Pool, QueryResultRow } from 'pg';
import path from 'path';
import { readFile } from 'fs/promises';
import {UserPermission} from "@/types/next-auth";

class DbService {
    private static instance: DbService;
    private pool: Pool;
    private isInitialized = false;

    private constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            max: 20,
            idleTimeoutMillis: 30000,
        });

        this.pool.on('error', (err) => console.error('Ошибка в пуле pg:', err));
    }

    public static getInstance(): DbService {
        if (!DbService.instance) {
            DbService.instance = new DbService();
        }
        return DbService.instance;
    }

    /**
     * Декомпозированная авто-инициализация схемы из внешнего SQL файла
     */
    private async initSchema(): Promise<void> {
        if (this.isInitialized) return;

        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Читаем SQL-скрипт структуры таблиц из файла схемы
            const schemaPath = path.join(process.cwd(), 'src/services/schema.sql');
            const sqlQueries = await readFile(schemaPath, 'utf-8');

            // Накатываем структуру таблиц и базовые роли
            await client.query(sqlQueries);

            // Динамически прописываем суперпользователя ИБ из переменных окружения (.env)
            const defaultAdmin = process.env.DEFAULT_ADMIN_USERNAME;

            if (defaultAdmin && defaultAdmin.trim() !== '') {
                await client.query(`
          INSERT INTO user_role_exceptions (username, role_id, reason)
          SELECT $1, r.id, 'Первоначальный администратор безопасности (создан автоматически из .env)'
          FROM roles r 
          WHERE r.name = 'ADMIN'
          ON CONFLICT (username) DO NOTHING;
        `, [defaultAdmin.trim()]);

                console.log(`--- СУБД Инициализация: Проверена структура, создан админ из .env: ${defaultAdmin} ---`);
            } else {
                console.warn('--- СУБД Инициализация ПРЕДУПРЕЖДЕНИЕ: Переменная DEFAULT_ADMIN_USERNAME не задана в .env. ---');
            }

            await client.query('COMMIT');
            this.isInitialized = true;
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Критическая ошибка применения миграции схемы БД:', error);
        } finally {
            client.release();
        }
    }

    /**
     * Универсальная обертка для безопасного выполнения любого SQL запроса приложения
     */
    public async query<T extends QueryResultRow = QueryResultRow>(
        text: string,
        params?: unknown[]
    ): Promise<T[]> {
        if (!this.isInitialized) {
            await this.initSchema();
        }
        const res = await this.pool.query<T>(text, params);
        return res.rows;
    }

    /**
     * Сбор приоритетных прав (Исключения -> Маппинги должностей -> Матрица доступов)
     */
    public async getUserPermissions(username: string, ldapPosition: string) {
        if (!this.isInitialized) {
            await this.initSchema();
        }

        // Текстовый SQL-запрос сбора прав (был написан на первом этапе)
        const queryText = `
      WITH user_role AS (
        SELECT role_id FROM user_role_exceptions WHERE username = $1
        UNION ALL
        SELECT role_id FROM ldap_position_mappings WHERE ldap_position = $2
        LIMIT 1
      )
      SELECT 
        r.name as role,
        COALESCE(
          json_agg(json_build_object('path', p.route_path, 'method', p.method)) FILTER (WHERE p.id IS NOT NULL), 
          '[]'::json
        ) as permissions
      FROM user_role ur
      JOIN roles r ON ur.role_id = r.id
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      LEFT JOIN permissions p ON rp.permission_id = p.id
      GROUP BY r.name;
    `;

        const rows = await this.query<{ role: string; permissions: UserPermission[] }>(queryText, [username, ldapPosition]);
        return rows[0] || null;
    }
}

export const db = DbService.getInstance();
