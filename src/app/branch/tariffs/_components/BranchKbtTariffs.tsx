"use client";

import { useBranchLocation } from "../../_components/BranchFrame";
import { kbtTariffs } from "../../_components/mock";
import { BranchRateListTariffs } from "./BranchRateListTariffs";

export function BranchKbtTariffs() {
    const { branchId } = useBranchLocation();
    return <BranchRateListTariffs title="Услуги КБТ" rows={kbtTariffs(branchId)} />;
}
