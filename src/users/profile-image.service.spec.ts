import { ConfigService } from '@nestjs/config';
import { ProfileImageService, signS3Put } from './profile-image.service';

describe('profile image storage', () => {
  afterEach(() => jest.restoreAllMocks());
  it('matches an independent botocore S3SigV4Auth fixture including session credentials', () => {
    const headers = signS3Put(
      new URL(
        'https://example-bucket.s3.ap-northeast-2.amazonaws.com/profile-images/test/image.png',
      ),
      Buffer.from('test-image-bytes'),
      'image/png',
      'ap-northeast-2',
      {
        accessKeyId: 'EXAMPLEKEY',
        secretAccessKey: 'example-secret',
        sessionToken: 'example-session',
      },
      new Date('2026-01-01T00:00:00Z'),
    );
    expect(headers.Authorization).toBe(
      'AWS4-HMAC-SHA256 Credential=EXAMPLEKEY/20260101/ap-northeast-2/s3/aws4_request, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date;x-amz-security-token, Signature=d869497ee5606bc2902950ea103f0d3a57864dec7f9dcbc06591d5b39e16f022',
    );
  });
  it('rejects missing and disguised files before contacting storage', async () => {
    const service = new ProfileImageService(new ConfigService());
    const fetcher = jest.spyOn(global, 'fetch');
    await expect(service.upload('user')).rejects.toThrow('5MB');
    await expect(
      service.upload('user', {
        buffer: Buffer.from('<script>bad</script>'),
        mimetype: 'image/png',
        size: 20,
      }),
    ).rejects.toThrow('PNG');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('stores valid images under the user prefix and returns the configured public URL', async () => {
    const service = new ProfileImageService(
      new ConfigService({
        S3_BUCKET: 'test-bucket',
        S3_REGION: 'ap-northeast-2',
        S3_PUBLIC_BASE_URL: 'https://images.example.com',
        AWS_ACCESS_KEY_ID: 'test',
        AWS_SECRET_ACCESS_KEY: 'test',
      }),
    );
    const fetcher = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('', { status: 200 }));
    const image = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
    const result = await service.upload('user-uuid', {
      buffer: image,
      size: image.length,
      mimetype: 'image/png',
    });
    expect(result).toMatch(
      /^https:\/\/images\.example\.com\/profile-images\/user-uuid\/[a-f0-9-]+\.png$/,
    );
    expect(fetcher).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          Authorization: expect.stringContaining('AWS4-HMAC-SHA256'),
        }),
      }),
    );
  });
});
