import { redirect } from "next/navigation";
import { can } from "@/lib/access";
import { getRequestAccess } from "@/server/authz/resolve-access";
import { NewsForm } from "../../_components/NewsForm";

export default async function NewsEditPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ preview?: string | string[] }>;
}) {
    const access = await getRequestAccess();
    if (!access) {
        redirect("/login");
    }
    if (!can(access, "news:write")) {
        redirect("/forbidden");
    }
    const id = (await params).id;
    if (!/^\d+$/.test(id)) {
        redirect("/news");
    }
    const preview = (await searchParams).preview;
    const startInPreview = preview === "1" || (Array.isArray(preview) && preview.includes("1"));
    return <NewsForm postId={Number(id)} startInPreview={startInPreview} />;
}
