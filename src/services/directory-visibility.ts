/** Помеченный филиал остаётся в месяце, если на этот месяц уже есть участие или коэффициенты. */
export function branchListedInPeriod(alias: string, periodParam: string): string {
    return `(
        NOT ${alias}.deleted
        OR EXISTS (
            SELECT 1
            FROM basket_branch_motivation listed_motivation
            WHERE listed_motivation.territory_uuid = ${alias}.territory_uuid
              AND listed_motivation.branch_uuid = ${alias}.uuid
              AND listed_motivation.period = ${periodParam}::date
        )
        OR EXISTS (
            SELECT 1
            FROM basket_branch_coefficients listed_coefficient
            WHERE listed_coefficient.territory_uuid = ${alias}.territory_uuid
              AND listed_coefficient.branch_uuid = ${alias}.uuid
              AND listed_coefficient.period = ${periodParam}::date
        )
    )`;
}

/**
 * Срез участия на месяц.
 * У помеченного филиала более ранний месяц не переносится,
 * кроме случая, когда на выбранный месяц уже записаны коэффициенты.
 */
export const PERIOD_MOTIVATION_SQL = `
    SELECT DISTINCT ON (motivation.branch_uuid)
           motivation.branch_uuid::text AS "branchUuid",
           motivation.enabled
    FROM basket_branch_motivation motivation
    JOIN branches branch ON branch.uuid = motivation.branch_uuid
    WHERE motivation.territory_uuid = $1
      AND motivation.period <= $2::date
      AND (
          NOT branch.deleted
          OR motivation.period = $2::date
          OR EXISTS (
              SELECT 1
              FROM basket_branch_coefficients listed_coefficient
              WHERE listed_coefficient.territory_uuid = motivation.territory_uuid
                AND listed_coefficient.branch_uuid = motivation.branch_uuid
                AND listed_coefficient.period = $2::date
          )
      )
    ORDER BY motivation.branch_uuid, motivation.period DESC
`;

/** Помеченная территория остаётся в списке, если для неё уже есть карточка. */
export function territoryWithCard(alias: string): string {
    return `(
        NOT ${alias}.deleted
        OR EXISTS (
            SELECT 1
            FROM basket_connections listed_connection
            WHERE listed_connection.territory_uuid = ${alias}.uuid
        )
    )`;
}
