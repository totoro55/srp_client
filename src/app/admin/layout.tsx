export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="w-full mx-auto px-4 md:px-8 py-6 md:py-8 flex flex-col gap-6">
            {children}
        </div>
    );
}