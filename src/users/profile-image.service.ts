import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomUUID } from 'node:crypto';

export interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

// S3 REST signing keeps the existing dependency set and uses Lambda execution-role credentials.
// https://docs.aws.amazon.com/AmazonS3/latest/developerguide/sig-v4-header-based-auth.html
export function signS3Put(
  url: URL,
  body: Buffer,
  contentType: string,
  region: string,
  credentials: { accessKeyId: string; secretAccessKey: string; sessionToken?: string },
  now = new Date(),
): Record<string, string> {
  const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
  const hmac = (key: string | Buffer, value: string) =>
    createHmac('sha256', key).update(value).digest();
  const date = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const headers: Record<string, string> = {
    'content-type': contentType,
    host: url.host,
    'x-amz-content-sha256': hash(body),
    'x-amz-date': date,
  };
  if (credentials.sessionToken) headers['x-amz-security-token'] = credentials.sessionToken;
  const keys = Object.keys(headers).sort();
  const signed = keys.join(';');
  const canonical = [
    'PUT',
    url.pathname,
    '',
    keys.map((key) => `${key}:${headers[key]}\n`).join(''),
    signed,
    hash(body),
  ].join('\n');
  const scope = `${date.slice(0, 8)}/${region}/s3/aws4_request`;
  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${credentials.secretAccessKey}`, date.slice(0, 8)), region), 's3'),
    'aws4_request',
  );
  const signature = createHmac('sha256', signingKey)
    .update(`AWS4-HMAC-SHA256\n${date}\n${scope}\n${hash(canonical)}`)
    .digest('hex');
  headers.Authorization = `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope}, SignedHeaders=${signed}, Signature=${signature}`;
  return headers;
}

@Injectable()
export class ProfileImageService {
  constructor(private readonly config: ConfigService) {}

  async upload(userUuid: string, file?: UploadedImage): Promise<string> {
    if (!file?.buffer?.length || file.size > 5 * 1024 * 1024)
      throw new BadRequestException('5MB 이하의 이미지가 필요합니다');
    const b = file.buffer;
    const format = b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      ? ['image/png', 'png']
      : b[0] === 255 && b[1] === 216 && b[2] === 255
        ? ['image/jpeg', 'jpg']
        : ['GIF87a', 'GIF89a'].includes(b.subarray(0, 6).toString())
          ? ['image/gif', 'gif']
          : b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP'
            ? ['image/webp', 'webp']
            : null;
    if (!format || format[0] !== file.mimetype)
      throw new BadRequestException('PNG, JPEG, GIF, WebP 이미지만 업로드할 수 있습니다');
    const bucket = this.config.get<string>('S3_BUCKET');
    const region =
      this.config.get<string>('S3_REGION') ??
      this.config.get<string>('AWS_REGION') ??
      'ap-northeast-2';
    const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');
    if (!bucket || !accessKeyId || !secretAccessKey)
      throw new ServiceUnavailableException('프로필 이미지 저장소 설정이 필요합니다');
    const key = `profile-images/${userUuid}/${randomUUID()}.${format[1]}`;
    const url = new URL(`https://${bucket}.s3.${region}.amazonaws.com/${key}`);
    const headers = signS3Put(url, b, file.mimetype, region, {
      accessKeyId,
      secretAccessKey,
      sessionToken: this.config.get<string>('AWS_SESSION_TOKEN'),
    });
    const res = await fetch(url, {
      method: 'PUT',
      headers,
      body: new Uint8Array(b),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new ServiceUnavailableException('이미지 업로드에 실패했습니다');
    const publicBase = this.config.get<string>('S3_PUBLIC_BASE_URL') || url.origin;
    return `${publicBase.replace(/\/+$/, '')}/${key}`;
  }
}
