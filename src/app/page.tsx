import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { getRequestAccess } from "@/server/authz/resolve-access";

export default async function Home() {
    const session = await getServerSession(authOptions);
    if (!session) {
        redirect("/login");
    }

    const access = await getRequestAccess();

    return (
        <div className="mx-auto flex h-9/10 w-full max-w-2xl flex-col items-center justify-center gap-2">
            <p>{`Добро пожаловать, ${session.user.displayName}!`}</p>
            <p className="text-sm text-muted-foreground">
                {access?.role
                    ? `${access.role.name} · ${access.scopeLabel}`
                    : access?.scopeLabel ?? "Роль не назначена"}
            </p>
            {access?.previewRoleName ? (
                <p className="text-sm">Просмотр от имени роли. Изменения недоступны.</p>
            ) : null}
        </div>
    );
}
