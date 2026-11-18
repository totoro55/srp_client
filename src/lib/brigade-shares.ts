import { splitByHours } from "@/lib/premium-split";

/** Корзины, которые бригада делит по часам табеля. Оклад, фикс, услуги и общая премия сюда не входят. */
export const BRIGADE_INDICATORS = [
    "Продажа товара",
    "Выдача товара",
    "Кассовые операции",
    "ОСНТ",
    "Складские операции",
    "Разгрузка ТС",
    "Набор товара",
] as const;

export type BrigadeIndicator = (typeof BRIGADE_INDICATORS)[number];

const INDICATOR_SET = new Set<string>(BRIGADE_INDICATORS);

export function isBrigadeIndicator(value: string): value is BrigadeIndicator {
    return INDICATOR_SET.has(value);
}

export interface BrigadePoolSegment {
    key: string;
    employeeId: string;
    activeFrom: string;
    activeUntil: string;
    hours: number;
    /** Личная премия корзины за отрезок. */
    premium: number;
    /**
     * Отрезок не переписывается: начисление, увольнение, перевод, смена должности
     * или даты вне окна пересчёта.
     */
    locked: boolean;
    /** Уже записанная доля. null — доли бригады по этому отрезку ещё не было. */
    storedShare: number | null;
}

export interface BrigadeShareLine {
    key: string;
    employeeId: string;
    activeFrom: string;
    activeUntil: string;
    premium: number;
    /** false — строку не трогаем, доля уже лежит в таблице. */
    write: boolean;
}

/**
 * Котёл — личные премии участников, которых можно пересчитать, и личные премии
 * замороженных, у которых доля уже записана. Записанная доля вычитается.
 * Остаток делится по часам. Замороженный без доли остаётся при личной премии
 * и в котёл не входит. Нулевые часы получают 0, их премия остаётся в котле.
 */
export function splitBrigadePool(segments: readonly BrigadePoolSegment[]): BrigadeShareLine[] {
    let poolKopecks = 0;
    let frozenKopecks = 0;
    const open: BrigadePoolSegment[] = [];
    const kept: BrigadeShareLine[] = [];
    for (const segment of segments) {
        const personal = Math.round(segment.premium * 100);
        if (segment.locked) {
            if (segment.storedShare === null) {
                continue;
            }
            poolKopecks += personal;
            frozenKopecks += Math.round(segment.storedShare * 100);
            kept.push({
                key: segment.key,
                employeeId: segment.employeeId,
                activeFrom: segment.activeFrom,
                activeUntil: segment.activeUntil,
                premium: segment.storedShare,
                write: false,
            });
            continue;
        }
        poolKopecks += personal;
        open.push(segment);
    }
    const remaining = Math.max(0, poolKopecks - frozenKopecks) / 100;
    const shares = splitByHours(
        remaining,
        open.map((segment) => ({ key: segment.key, hours: segment.hours > 0 ? segment.hours : 0 })),
    );
    return [
        ...kept,
        ...open.map((segment) => ({
            key: segment.key,
            employeeId: segment.employeeId,
            activeFrom: segment.activeFrom,
            activeUntil: segment.activeUntil,
            premium: shares[segment.key] ?? 0,
            write: true,
        })),
    ];
}
