import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

/**
 * Cloudflare R2 Storage Service
 * S3-compatible object storage for file uploads
 */
export class R2StorageService {
  private s3Client: S3Client | null = null;
  private bucketName: string;
  private accountId: string;
  private enabled: boolean = false;

  constructor() {
    // R2 Configuration
    const accountId = process.env.R2_ACCOUNT_ID || '';
    const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
    this.bucketName = process.env.R2_BUCKET_NAME || 'builder';
    this.accountId = accountId;

    if (accountId && accessKeyId && secretAccessKey) {
      try {
        // Use EU endpoint for European jurisdiction
        const endpoint = process.env.R2_ENDPOINT || `https://${accountId}.eu.r2.cloudflarestorage.com`;
        
        this.s3Client = new S3Client({
          region: 'auto',
          endpoint,
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        });
        
        this.enabled = true;
        console.log('✅ Cloudflare R2 connected');
        console.log(`   Bucket: ${this.bucketName}`);
        console.log(`   Endpoint: ${endpoint}`);
      } catch (error) {
        console.error('❌ Failed to initialize R2:', error);
        this.enabled = false;
      }
    } else {
      console.warn('⚠️  R2 not configured (missing env vars). Files will be stored in database.');
      console.warn('   Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME');
    }
  }

  /**
   * Check if R2 is enabled and configured
   */
  isEnabled(): boolean {
    return this.enabled && this.s3Client !== null;
  }

  /**
   * Upload a file to R2
   * @param filePath - Path to store file (e.g., 'projects/123/App.tsx')
   * @param content - File content
   * @param contentType - MIME type (default: 'text/plain')
   * @returns URL to access the file
   */
  async uploadFile(
    filePath: string,
    content: string | Buffer,
    contentType: string = 'text/plain'
  ): Promise<string> {
    if (!this.s3Client) {
      throw new Error('R2 is not configured');
    }

    try {
      const key = `${filePath}`;
      
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: content,
        ContentType: contentType,
      });

      await this.s3Client.send(command);
      
      // Return the R2 URL
      const url = `https://${this.accountId}.r2.cloudflarestorage.com/${this.bucketName}/${key}`;
      console.log(`✅ Uploaded to R2: ${key}`);
      
      return url;
    } catch (error) {
      console.error('Failed to upload to R2:', error);
      throw error;
    }
  }

  /**
   * Upload multiple files (bulk upload)
   */
  async uploadFiles(
    files: Array<{ path: string; content: string; contentType?: string }>
  ): Promise<Array<{ path: string; url: string }>> {
    const results = [];
    
    for (const file of files) {
      const url = await this.uploadFile(
        file.path,
        file.content,
        file.contentType || this.getContentType(file.path)
      );
      results.push({ path: file.path, url });
    }
    
    return results;
  }

  /**
   * Get a file from R2
   */
  async getFile(filePath: string): Promise<string> {
    if (!this.s3Client) {
      throw new Error('R2 is not configured');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: filePath,
      });

      const response = await this.s3Client.send(command);
      const body = await response.Body?.transformToString();
      
      return body || '';
    } catch (error) {
      console.error('Failed to get file from R2:', error);
      throw error;
    }
  }

  /**
   * Delete a file from R2
   */
  async deleteFile(filePath: string): Promise<void> {
    if (!this.s3Client) {
      throw new Error('R2 is not configured');
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: filePath,
      });

      await this.s3Client.send(command);
      console.log(`✅ Deleted from R2: ${filePath}`);
    } catch (error) {
      console.error('Failed to delete from R2:', error);
      throw error;
    }
  }

  /**
   * List files in a directory
   */
  async listFiles(prefix: string): Promise<string[]> {
    if (!this.s3Client) {
      throw new Error('R2 is not configured');
    }

    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
      });

      const response = await this.s3Client.send(command);
      return response.Contents?.map(item => item.Key || '') || [];
    } catch (error) {
      console.error('Failed to list files from R2:', error);
      throw error;
    }
  }

  /**
   * Generate a signed URL for temporary access
   * @param filePath - File path in R2
   * @param expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
   */
  async getSignedUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
    if (!this.s3Client) {
      throw new Error('R2 is not configured');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: filePath,
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });
      return url;
    } catch (error) {
      console.error('Failed to generate signed URL:', error);
      throw error;
    }
  }

  /**
   * Get content type from file extension
   */
  private getContentType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    
    const mimeTypes: Record<string, string> = {
      'tsx': 'text/typescript',
      'ts': 'text/typescript',
      'jsx': 'text/javascript',
      'js': 'text/javascript',
      'json': 'application/json',
      'css': 'text/css',
      'html': 'text/html',
      'md': 'text/markdown',
      'txt': 'text/plain',
      'svg': 'image/svg+xml',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
    };

    return mimeTypes[ext || ''] || 'text/plain';
  }

  /**
   * Generate a unique file path for a project file
   */
  generateFilePath(projectId: number, fileName: string): string {
    const hash = crypto.randomBytes(8).toString('hex');
    return `projects/${projectId}/${hash}/${fileName}`;
  }
}

// Export singleton
export const r2StorageService = new R2StorageService();

