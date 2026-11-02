"use client";

import { useBranchLocation } from "../../_components/BranchFrame";
import { serviceTariffs } from "../../_components/mock";
import { BranchRateListTariffs } from "./BranchRateListTariffs";

export function BranchServiceTariffs() {
    const { branchId } = useBranchLocation();
    return <BranchRateListTariffs title="Услуги" rows={serviceTariffs(branchId)} />;
}
