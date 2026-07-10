'use client'
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {LogOut, MessageCircle, User, UserRoundCog} from "lucide-react";
import {useSession} from "next-auth/react";


export default  function UserInfo () {
    const session = useSession()

    if (!session.data?.user) return <></>

    return(
        <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" />}>
                <User />
                <p className="lg:contents hidden">
                    {session?.data?.user?.name}
                </p>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="lg:w-full w-48">
                <DropdownMenuGroup>
                    <DropdownMenuLabel>
                        <p className="lg:hidden contents">
                            {session?.data?.user?.name}
                        </p>
                        <p>
                            {session?.data?.user?.department}
                        </p>
                    </DropdownMenuLabel>
                    <DropdownMenuItem>
                        <UserRoundCog />
                        Профиль
                    </DropdownMenuItem>
                    {session?.data?.user?.role !== "user" &&
                        <DropdownMenuItem>
                            <MessageCircle />
                            Обратная связь
                        </DropdownMenuItem>
                    }
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem>
                        <LogOut />
                        Выйти
                    </DropdownMenuItem>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}