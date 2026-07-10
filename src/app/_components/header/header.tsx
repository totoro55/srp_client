'use client'
import {SidebarTrigger} from "@/components/ui/sidebar";
import UserInfo from "@/app/_components/header/userInfo";
import {useSession} from "next-auth/react";

export default function Header(){
    const session = useSession();

    return (
        <header className='w-full flex flex-row items-center justify-between'>
            <SidebarTrigger />
            <UserInfo/>
        </header>
    )
}