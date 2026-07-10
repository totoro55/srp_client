import {getServerSession} from "next-auth";
import {Button} from "@/components/ui/button";
import Link from "next/link";
import {redirect} from "next/navigation";

export default async function Home() {
    const session = await getServerSession();
    if (!session) {
        return redirect("/login");
    }

    return (
            <div className="flex flex-col items-center justify-center w-full max-w-2xl mx-auto h-9/10">
                {!session &&
                    <Button
                        nativeButton={false}
                        render={<Link href={"/login"}/>}>
                        Авторизоваться
                    </Button>
                }
                {session &&
                    <>
                        <p>
                            {`Добро пожаловать, ${session?.user?.name}!`}
                        </p>
                    </>
                }
            </div>
    )
        ;
}
