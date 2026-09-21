'use client'
import {SidebarTrigger} from "@/components/ui/sidebar";
import {Separator} from "@/components/ui/separator";
import {usePathname} from "next/navigation";
import {APP_ROUTES} from "@/app/_components/appRoutes";

export default function Header() {

    const pathname = usePathname()
    const title = APP_ROUTES.find(r=>r.href===pathname)?.title;

    return (
        <header className='w-full xl:p-3 p-1.5 border-b
         flex flex-row items-center justify-start'>
            <SidebarTrigger />
            {title && <>
                <Separator orientation="vertical" className="xl:mx-3 mx-1.5" />
                <h1 className="font-bold xl:text-lg text-m">{title}</h1>
            </>}
        </header>
    )
}