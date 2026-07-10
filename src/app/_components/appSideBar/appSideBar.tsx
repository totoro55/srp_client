'use client'

import Link from 'next/link'
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem, SidebarMenuSkeleton, SidebarRail,
    useSidebar,
} from "@/components/ui/sidebar"
import {BriefcaseIcon, LogIn, LogOut} from "lucide-react";
import {signOut, useSession} from "next-auth/react";
import {ModeToggle} from "@/app/_components/appSideBar/modeToggle";

const routes =
    [
        {href: "/main", name: "Главная", icon: <BriefcaseIcon/>, roles: ["admin"]},
        // {href: "/div", name: "Мониторинг дивизиона", icon: <Gauge />, roles: ["SERVICE_ADMIN","ADMIN","DIV_MANAGER","RRS_MANAGER"]},
        // {href: "/rrs", name: "Мониторинг РРС", icon: <Building2 />, roles: ["SERVICE_ADMIN","ADMIN","DIV_MANAGER","RRS_MANAGER","MANAGER"]},
        // {href: "/firm", name: "Мониторинг Филиала", icon: <HomeIcon/>, roles: ["SERVICE_ADMIN","ADMIN","DIV_MANAGER","RRS_MANAGER","MANAGER","DEPUTY_MANAGER"]},
        // {href: "/user", name: "Пользователь", icon: <UserRound />, roles: []},
        // {href: "/details", name: "Детализация по сотруднику", icon: <List />, roles: []},
    ]

export default function AppSideBar() {
    const session = useSession()
    const {state} = useSidebar()
    console.log(session)

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader>
                {state === "collapsed"
                    ? <SidebarMenu>
                        <SidebarMenuItem className="flex flex-row justify-between items-center w-full">
                            <h4 className="scroll-m-20 text-s font-semibold tracking-tight">
                                CРП
                            </h4>
                        </SidebarMenuItem>
                    </SidebarMenu>
                    : <SidebarMenu>
                        <SidebarMenuItem className="flex flex-row justify-between items-center w-full">
                            <h4 className="scroll-m-20 text-lg font-semibold tracking-tight">
                                СРП
                            </h4>
                        </SidebarMenuItem>
                    </SidebarMenu>
                }

            </SidebarHeader>
            <SidebarContent>
                    <SidebarMenu>
                        {session.status === "authenticated" &&
                            routes
                                .filter(r => r.roles.includes(session.data.user.role) || r.roles.length < 1)
                                .map((route) => (
                                    <SidebarMenuItem className="flex flex-row justify-center" key={route.name}>
                                        <SidebarMenuButton tooltip={route.name} render={<Link href={route.href}/>}>
                                            {route.icon}
                                            {route.name}
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                        {session.data &&
                            <SidebarMenuItem className="flex flex-row justify-center">
                                <SidebarMenuButton
                                    tooltip="Выйти"
                                    onClick={() => signOut()}
                                    render={<Link href={"/login"}/>}>
                                    <LogOut/>
                                    {"Выйти"}
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        }
                    </SidebarMenu>
            </SidebarContent>
            <SidebarFooter className="flex justify-center items-end">
                <ModeToggle/>
            </SidebarFooter>
        </Sidebar>
    )
}