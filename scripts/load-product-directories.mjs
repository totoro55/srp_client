import fs from "fs";
import path from "path";
import pg from "pg";

const env = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
const connectionString = env.match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim();
if (!connectionString) {
    throw new Error("В .env.local нет DATABASE_URL");
}

const csvDir = process.argv[2];
const period = process.argv[3];
if (!csvDir || !/^\d{4}-\d{2}-01$/.test(period ?? "")) {
    throw new Error("Укажите каталог с CSV и месяц выгрузки в виде YYYY-MM-01");
}

function readCsv(fileName) {
    const text = fs.readFileSync(path.join(csvDir, fileName), "utf8").replace(/^\uFEFF/, "");
    const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
    const header = splitCsv(lines[0]);
    return lines.slice(1).map((line) => {
        const cells = splitCsv(line);
        const row = {};
        header.forEach((key, index) => {
            const value = cells[index] ?? "";
            row[key] = value === "" ? null : value;
        });
        return row;
    });
}

function splitCsv(line) {
    const cells = [];
    let current = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        if (quoted) {
            if (char === "\"") {
                if (line[index + 1] === "\"") {
                    current += "\"";
                    index += 1;
                } else {
                    quoted = false;
                }
            } else {
                current += char;
            }
            continue;
        }
        if (char === "\"") {
            quoted = true;
            continue;
        }
        if (char === ",") {
            cells.push(current);
            current = "";
            continue;
        }
        current += char;
    }
    cells.push(current);
    return cells;
}

const pool = new pg.Pool({ connectionString });
const client = await pool.connect();
try {
    await client.query("BEGIN");
    const migrationPath = path.join(process.cwd(), "src/services/migrations/023_product_directories_and_stats.sql");
    await client.query(fs.readFileSync(migrationPath, "utf8"));
    await client.query(
        "INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING",
        ["023_product_directories_and_stats.sql"],
    );

    const categories = readCsv("categories.csv");
    const kinds = readCsv("kinds.csv");
    const categoryStats = readCsv("category_stats.csv");
    const kindStats = readCsv("kind_stats.csv");

    await insertDirectories(client, "product_categories", categories);
    await insertDirectories(client, "product_kinds", kinds);
    await insertStats(client, "basket_category_stats", "category_uuid", categoryStats, period);
    await insertStats(client, "basket_kind_stats", "kind_uuid", kindStats, period);

    const counts = await client.query(`
        SELECT
            (SELECT count(*) FROM product_categories) AS categories,
            (SELECT count(*) FROM product_kinds) AS kinds,
            (SELECT count(*) FROM basket_category_stats) AS category_stats,
            (SELECT count(*) FROM basket_kind_stats) AS kind_stats
    `);
    await client.query("COMMIT");
    console.log(JSON.stringify(counts.rows[0]));
} catch (error) {
    await client.query("ROLLBACK");
    throw error;
} finally {
    client.release();
    await pool.end();
}

async function insertDirectories(client, table, rows) {
    const chunkSize = 400;
    for (let offset = 0; offset < rows.length; offset += chunkSize) {
        const chunk = rows.slice(offset, offset + chunkSize);
        const values = [];
        const params = [];
        chunk.forEach((row, index) => {
            const base = index * 5;
            values.push(`($${base + 1}::uuid, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`);
            params.push(row.uuid, row.name, row.parent_1, row.parent_2, row.parent_3);
        });
        await client.query(
            `
            INSERT INTO ${table} (uuid, name, parent_1, parent_2, parent_3)
            VALUES ${values.join(", ")}
            ON CONFLICT (uuid) DO UPDATE
            SET name = EXCLUDED.name,
                parent_1 = EXCLUDED.parent_1,
                parent_2 = EXCLUDED.parent_2,
                parent_3 = EXCLUDED.parent_3
            `,
            params,
        );
    }
}

async function insertStats(client, table, codeColumn, rows, period) {
    const chunkSize = 400;
    for (let offset = 0; offset < rows.length; offset += chunkSize) {
        const chunk = rows.slice(offset, offset + chunkSize);
        const values = [];
        const params = [];
        chunk.forEach((row, index) => {
            const base = index * 5;
            values.push(`($${base + 1}::uuid, $${base + 2}::date, $${base + 3}::uuid, $${base + 4}::numeric, $${base + 5}::numeric)`);
            params.push(row.territory_uuid, period, row.code, row.avg_price, row.sum_quantity);
        });
        await client.query(
            `
            INSERT INTO ${table} (territory_uuid, period, ${codeColumn}, avg_price, sum_quantity)
            VALUES ${values.join(", ")}
            ON CONFLICT (territory_uuid, period, ${codeColumn}) DO UPDATE
            SET avg_price = EXCLUDED.avg_price,
                sum_quantity = EXCLUDED.sum_quantity,
                loaded_at = NOW()
            `,
            params,
        );
    }
}
