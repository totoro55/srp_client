import { redirect } from "next/navigation";

export default function BasketUpdatesPage() {
    redirect("/admin/monitoring?tab=calculations");
}
