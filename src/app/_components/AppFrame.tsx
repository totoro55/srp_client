'use client';

import type { ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { SidebarProvider } from '@/components/ui/sidebar';
import Header from '@/app/_components/header/header';
import { PageHeadingProvider } from '@/app/_components/header/page-heading';
import { AccessBanner } from '@/app/_components/AccessBanner';
import { AppSideBar } from '@/app/_components/appSideBar/AppSideBar';
import { cn } from '@/lib/utils';

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
    const signedIn = status === 'loading' ? initialSignedIn : status === 'authenticated';

    return (
        <SidebarProvider defaultOpen={false}>
            {signedIn ? <AppSideBar /> : null}
            <PageHeadingProvider>
                <main className={cn('w-full', signedIn && 'pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0')}>
                    {notice}
                    {signedIn ? <AccessBanner /> : null}
                    {signedIn ? <Header /> : null}
                    {children}
                </main>
            </PageHeadingProvider>
        </SidebarProvider>
    );
}
