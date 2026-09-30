import { useAccess } from "@/hooks/useAccess";

export function useImpersonationMask() {
    const access = useAccess();
    return {
        previewRoleName: access.previewRoleName,
        permissions: access.permissions,
    };
}
