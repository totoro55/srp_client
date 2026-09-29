export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-[calc(100dvh-4.75rem)] min-h-0 flex-col overflow-hidden px-4 py-4 md:px-8 md:py-6">
            <div className="flex min-h-0 flex-1 flex-col">
                {children}
            </div>
        </div>
    );
}
