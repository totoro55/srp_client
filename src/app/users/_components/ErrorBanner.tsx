import { Button } from "@/components/ui/button";
import { IApiError } from "@/app/api/users/route";

interface ErrorBannerProps {
    error: IApiError;
    onRetry: () => void;
}

export function ErrorBanner({ error, onRetry }: ErrorBannerProps) {
    return (
        <div className="p-4 border border-destructive/30 bg-destructive/5 rounded-md text-sm flex justify-between items-center">
            <div>
                <h2 className="font-semibold text-destructive">Ошибка запроса ({error.statusCode})</h2>
                <p className="text-muted-foreground mt-1">{error.message}</p>
            </div>
            <Button variant="outline" size="sm" onClick={onRetry}>Повторить</Button>
        </div>
    );
}
