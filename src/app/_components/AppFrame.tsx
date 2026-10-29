'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { SidebarProvider } from '@/components/ui/sidebar';
import Header from '@/app/_components/header/header';
import { PageHeadingProvider } from '@/app/_components/header/page-heading';
import { AccessBanner } from '@/app/_components/AccessBanner';
import { AppSideBar } from '@/app/_components/appSideBar/AppSideBar';

export function AppFrame({
    initialSignedIn,
    notice,
    children,
}: {
    initialSignedIn: boolean;
    notice: ReactNode;
    children: ReactNode;
}) {
    const { status } = useSession();
    const pathname = usePathname();
    const signedIn = status === 'loading' ? initialSignedIn : status === 'authenticated';
    const sessionClosed = status === 'unauthenticated' && pathname !== '/login';

    useEffect(() => {
        if (!sessionClosed) {
            return;
        }
        window.location.replace('/login');
    }, [sessionClosed]);

    if (sessionClosed) {
        return null;
    }

    return (
        <SidebarProvider defaultOpen={false}>
            {signedIn ? <AppSideBar /> : null}
            <PageHeadingProvider>
                <main className="flex min-w-0 flex-1 flex-col">
                    {notice}
                    {signedIn ? <AccessBanner /> : null}
                    {signedIn ? <Header /> : null}
                    {children}
                </main>
            </PageHeadingProvider>
        </SidebarProvider>
    );
}
