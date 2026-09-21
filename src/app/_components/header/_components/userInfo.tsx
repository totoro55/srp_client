'use client'
import {Button} from "@/components/ui/button"
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
import Feedback from "@/app/_components/header/_components/feedback";
import {useState} from "react";


export default function UserInfo() {
    const [openFeedback, setOpenFeedback] = useState(false);
    const session = useSession()

    if (!session.data?.user) return <></>

    return (
        <>
            <Feedback open={openFeedback} setOpen={setOpenFeedback}/>
            <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost"/>}>
                    <User/>
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

                        {/*{session?.data?.user?.role !== "user" &&*/}
                        {/*    <>*/}
                        {/*        <DropdownMenuItem>*/}
                        {/*            <UserRoundCog />*/}
                        {/*            Профиль*/}
                        {/*        </DropdownMenuItem>*/}
                        {/*        <DropdownMenuItem onClick={() => setOpenFeedback(true)}>*/}
                        {/*            <MessageCircle/>*/}
                        {/*            Обратная связь*/}
                        {/*        </DropdownMenuItem>*/}
                        {/*    </>*/}
                        {/*}*/}
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator/>
                    <DropdownMenuGroup>
                        <DropdownMenuItem>
                            <LogOut/>
                            Выйти
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    )
}