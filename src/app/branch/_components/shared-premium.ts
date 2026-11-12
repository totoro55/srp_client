import { splitByHours } from "@/lib/premium-split";
import { technicalAccount } from "@/lib/technical-accounts";
import { inCalculation } from "./mock";
import { roleKey, type StaffEmployee } from "./staff";

export interface TechnicalPremium {
    id: string;
    name: string;
    sale: number;
    release: number;
}

export interface PromoterPremium {
    id: string;
    name: string;
    title: string;
    sale: number;
    release: number;
}

export interface PoolAuthor {
    id: string;
    name: string;
    title: string;
    kind: "staff" | "technical" | "promoter";
    sale: number;
    release: number;
    activeFrom: string | null;
}

export interface SharedPremium {
    pool: number;
    hours: number;
    shares: Record<string, number>;
    authors: PoolAuthor[];
}

export function sharedPremium(input: {
    employees: StaffEmployee[];
    roles: Record<string, string | null>;
    salePremiums: Record<string, number>;
    releasePremiums: Record<string, number>;
    technical: TechnicalPremium[];
    promoters: PromoterPremium[];
}): SharedPremium {
    const authors: PoolAuthor[] = [];
    for (const employee of input.employees) {
        const roleId = input.roles[roleKey(employee)] ?? null;
        if (inCalculation(employee, roleId)) {
            continue;
        }
        const sale = input.salePremiums[roleKey(employee)] ?? 0;
        const release = input.releasePremiums[roleKey(employee)] ?? 0;
        if (sale === 0 && release === 0) {
            continue;
        }
        authors.push({
            id: employee.id,
            name: employee.name,
            title: employee.title || "Должность не указана",
            kind: "staff",
            sale,
            release,
            activeFrom: employee.activeFrom,
        });
    }
    for (const account of input.technical) {
        if (!technicalAccount(account.id) || (account.sale === 0 && account.release === 0)) {
            continue;
        }
        authors.push({
            id: account.id,
            name: account.name,
            title: "Система",
            kind: "technical",
            sale: account.sale,
            release: account.release,
            activeFrom: null,
        });
    }
    for (const promoter of input.promoters) {
        if (promoter.sale === 0 && promoter.release === 0) {
            continue;
        }
        authors.push({
            id: promoter.id,
            name: promoter.name,
            title: promoter.title || "Промоутер",
            kind: "promoter",
            sale: promoter.sale,
            release: promoter.release,
            activeFrom: null,
        });
    }
    authors.sort((left, right) => (right.sale + right.release) - (left.sale + left.release) || left.name.localeCompare(right.name, "ru"));

    const pool = roundMoney(authors.reduce((sum, author) => sum + author.sale + author.release, 0));
    const recipients = input.employees.flatMap((employee) => {
        const roleId = input.roles[roleKey(employee)] ?? null;
        if (!inCalculation(employee, roleId)) {
            return [];
        }
        const hours = employee.timesheetHours ?? 0;
        return [{ key: roleKey(employee), hours: hours > 0 ? hours : 0 }];
    });
    const hours = roundMoney(recipients.reduce((sum, recipient) => sum + recipient.hours, 0));
    return {
        pool,
        hours,
        shares: splitByHours(pool, recipients),
        authors,
    };
}

function roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
}
