import { createWriteStream, existsSync } from 'fs';
import { mkdir, readFile, unlink } from 'fs/promises';
import { join, dirname } from 'path';
import { env } from '../env';
import { StorageError } from './errors';

// ---------------------------------------------------------------------------
// Interface comum — todas as estratégias respeitam este contrato
// ---------------------------------------------------------------------------

export interface StorageProvider {
  /**
   * Persiste o buffer no storage com o key fornecido.
   * Retorna a URL pública ou assinada do arquivo.
   */
  upload(key: string, buffer: Buffer, mimeType: string): Promise<string>;

  /** Retorna o conteúdo do arquivo como Buffer. */
  download(key: string): Promise<Buffer>;

  /** Remove o arquivo do storage. */
  delete(key: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Estratégia LOCAL
// ---------------------------------------------------------------------------

class LocalStorageProvider implements StorageProvider {
  private readonly basePath: string;
  private readonly baseUrl: string;

  constructor() {
    this.basePath = env.STORAGE_LOCAL_PATH;
    const host = env.SERVICE_HOST === '0.0.0.0' ? 'localhost' : env.SERVICE_HOST;
    this.baseUrl = `http://${host}:${env.PORT}/static`;
  }

  async upload(key: string, buffer: Buffer, _mimeType: string): Promise<string> {
    const filePath = join(this.basePath, key);
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    await new Promise<void>((resolve, reject) => {
      const ws = createWriteStream(filePath);
      ws.on('finish', resolve);
      ws.on('error', reject);
      ws.write(buffer);
      ws.end();
    });
    return `${this.baseUrl}/${key}`;
  }

  async download(key: string): Promise<Buffer> {
    const filePath = join(this.basePath, key);
    if (!existsSync(filePath)) {
      throw new StorageError(`Arquivo não encontrado no storage local: ${key}`);
    }
    return readFile(filePath);
  }

  async delete(key: string): Promise<void> {
    const filePath = join(this.basePath, key);
    if (existsSync(filePath)) {
      await unlink(filePath);
    }
  }
}

// ---------------------------------------------------------------------------
// Estratégia S3 / MinIO
// ---------------------------------------------------------------------------

class S3StorageProvider implements StorageProvider {
  private readonly bucket: string;

  constructor() {
    this.bucket = env.S3_BUCKET;
  }

  private async buildClient() {
    const { S3Client } = await import('@aws-sdk/client-s3');
    return new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY ?? '',
        secretAccessKey: env.S3_SECRET_KEY ?? '',
      },
      // Necessário para MinIO (path-style URLs)
      forcePathStyle: !!env.S3_ENDPOINT,
    });
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<string> {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await this.buildClient();
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );
    // Retorna URL assinada com validade curta para acesso imediato
    return this.signedUrl(key);
  }

  async download(key: string): Promise<Buffer> {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await this.buildClient();
    const response = await client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!response.Body) throw new StorageError(`Objeto S3 sem body: ${key}`);

    // SDK v3 retorna ReadableStream — converte para Buffer
    const stream = response.Body as NodeJS.ReadableStream;
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  async delete(key: string): Promise<void> {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await this.buildClient();
    await client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  /** Gera URL pré-assinada (validade 5 minutos). */
  async signedUrl(key: string, expiresIn = 300): Promise<string> {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const client = await this.buildClient();
    return getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn },
    );
  }
}

// ---------------------------------------------------------------------------
// Factory — seleciona provider via env STORAGE_PROVIDER
// ---------------------------------------------------------------------------

let _instance: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (_instance) return _instance;
  _instance =
    env.STORAGE_PROVIDER === 's3'
      ? new S3StorageProvider()
      : new LocalStorageProvider();
  return _instance;
}

export { S3StorageProvider };
