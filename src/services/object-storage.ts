import {
    CreateBucketCommand,
    DeleteObjectCommand,
    GetObjectCommand,
    HeadBucketCommand,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";
import { ContentError } from "@/services/content-error";

let clientCache: S3Client | null = null;
let bucketReady: Promise<void> | null = null;

function required(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new ContentError("Вложения сейчас недоступны");
    }
    return value;
}

function client(): S3Client {
    if (!clientCache) {
        clientCache = new S3Client({
            region: process.env.S3_REGION?.trim() || "us-east-1",
            endpoint: required("S3_ENDPOINT"),
            forcePathStyle: true,
            credentials: {
                accessKeyId: required("S3_ACCESS_KEY"),
                secretAccessKey: required("S3_SECRET_KEY"),
            },
        });
    }
    return clientCache;
}

function bucket(): string {
    return required("S3_BUCKET");
}

async function ensureBucket(): Promise<void> {
    if (!bucketReady) {
        const name = bucket();
        const storage = client();
        bucketReady = (async () => {
            try {
                await storage.send(new HeadBucketCommand({ Bucket: name }));
            } catch (error) {
                if (!missingBucket(error)) {
                    throw error;
                }
                await storage.send(new CreateBucketCommand({ Bucket: name }));
            }
        })().catch((error: unknown) => {
            bucketReady = null;
            throw error;
        });
    }
    await bucketReady;
}

export async function putStoredObject(key: string, body: Buffer, mime: string): Promise<void> {
    try {
        await ensureBucket();
        await client().send(new PutObjectCommand({
            Bucket: bucket(),
            Key: key,
            Body: body,
            ContentType: mime,
        }));
    } catch (error) {
        if (error instanceof ContentError) {
            throw error;
        }
        throw new ContentError("Не удалось сохранить вложение");
    }
}

export async function readStoredObject(key: string): Promise<Buffer | null> {
    try {
        await ensureBucket();
        const result = await client().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
        if (!result.Body) {
            return null;
        }
        return Buffer.from(await result.Body.transformToByteArray());
    } catch (error) {
        if (missingObject(error)) {
            return null;
        }
        if (error instanceof ContentError) {
            throw error;
        }
        throw new ContentError("Не удалось открыть вложение");
    }
}

export async function deleteStoredObject(key: string): Promise<void> {
    try {
        await ensureBucket();
        await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
    } catch (error) {
        if (error instanceof ContentError || missingObject(error)) {
            return;
        }
    }
}

function missingBucket(error: unknown): boolean {
    return named(error, "NotFound", "NoSuchBucket") || status(error) === 404;
}

function missingObject(error: unknown): boolean {
    return named(error, "NotFound", "NoSuchKey") || status(error) === 404;
}

function named(error: unknown, ...names: string[]): boolean {
    return typeof error === "object" && error !== null && "name" in error && names.includes(String(error.name));
}

function status(error: unknown): number | undefined {
    if (typeof error !== "object" || error === null || !("$metadata" in error)) {
        return undefined;
    }
    const metadata = error.$metadata;
    if (typeof metadata !== "object" || metadata === null || !("httpStatusCode" in metadata)) {
        return undefined;
    }
    return typeof metadata.httpStatusCode === "number" ? metadata.httpStatusCode : undefined;
}
