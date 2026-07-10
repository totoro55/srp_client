import React from "react";
import AuthForm from "./_components/authForm";
import {getServerSession} from "next-auth";
import {redirect} from "next/navigation";

export default async function LoginPage() {
    const session = await getServerSession();
    if (session) {
        return redirect("/");
    }

    return (
        <main className="w-full h-9/10 max-w-7xl mx-auto flex items-center justify-center">
            <AuthForm />
        </main>
);
}