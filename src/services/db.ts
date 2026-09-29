import { Pool, QueryResultRow } from "pg";
import path from "path";
import { readFile, readdir } from "fs/promises";

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

        this.pool.on("error", (err) => console.error("Ошибка в пуле pg:", err));
    }

    public static getInstance(): DbService {
        if (!DbService.instance) {
            DbService.instance = new DbService();
        }
        return DbService.instance;
    }

    private async runMigrations(): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query("BEGIN");
            await client.query(`
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    id TEXT PRIMARY KEY,
                    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            `);

            const migrationsDir = path.join(process.cwd(), "src/services/migrations");
            const files = (await readdir(migrationsDir))
                .filter((file) => file.endsWith(".sql"))
                .sort();

            const applied = await client.query<{ id: string }>("SELECT id FROM schema_migrations");
            const appliedIds = new Set(applied.rows.map((row) => row.id));

            for (const file of files) {
                if (appliedIds.has(file)) {
                    continue;
                }
                const sql = await readFile(path.join(migrationsDir, file), "utf-8");
                await client.query(sql);
                await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file]);
            }

            const defaultAdmin = process.env.DEFAULT_ADMIN_USERNAME;
            if (defaultAdmin && defaultAdmin.trim() !== "") {
                await client.query(
                    `
                    INSERT INTO user_role_exceptions (username, role_id, reason)
                    SELECT $1, r.id, 'Первоначальный администратор безопасности (создан автоматически из .env)'
                    FROM roles r
                    WHERE r.name = 'ADMIN'
                    ON CONFLICT (username) DO NOTHING
                    `,
                    [defaultAdmin.trim()]
                );
            }

            await client.query("COMMIT");
            this.isInitialized = true;
        } catch (error) {
            await client.query("ROLLBACK");
            this.isInitialized = false;
            console.error("Критическая ошибка применения миграции схемы БД:", error);
            throw error;
        } finally {
            client.release();
        }
    }

    public async query<T extends QueryResultRow = QueryResultRow>(
        text: string,
        params?: unknown[]
    ): Promise<T[]> {
        if (!this.isInitialized) {
            await this.runMigrations();
            const { syncPermissionCatalog } = await import("@/services/permission-catalog");
            await syncPermissionCatalog();
        }
        const res = await this.pool.query<T>(text, params);
        return res.rows;
    }

    public async getUserAuthContext(username: string, ldapPosition: string) {
        if (!this.isInitialized) {
            await this.runMigrations();
            const { syncPermissionCatalog } = await import("@/services/permission-catalog");
            await syncPermissionCatalog();
        }

        const queryText = `
            WITH user_role AS (
                SELECT role_id FROM user_role_exceptions
                WHERE username = $1 AND (expires_at IS NULL OR expires_at > NOW())

                UNION ALL

                SELECT role_id FROM ldap_position_mappings WHERE ldap_position = $2
                LIMIT 1
            )
            SELECT
                r.id as role_id,
                r.name as role,
                r.is_superuser
            FROM user_role ur
            JOIN roles r ON ur.role_id = r.id
        `;

        const rows = await this.query<{ role_id: number; role: string; is_superuser: boolean }>(
            queryText,
            [username, ldapPosition]
        );
        return rows[0] || null;
    }

    public async getRoleByName(name: string) {
        const rows = await this.query<{ id: number; name: string; is_superuser: boolean }>(
            "SELECT id, name, is_superuser FROM roles WHERE name = $1",
            [name]
        );
        return rows[0] || null;
    }

    public async getRoleById(id: number) {
        const rows = await this.query<{ id: number; name: string; is_superuser: boolean }>(
            "SELECT id, name, is_superuser FROM roles WHERE id = $1",
            [id]
        );
        return rows[0] || null;
    }
}

export const db = DbService.getInstance();
