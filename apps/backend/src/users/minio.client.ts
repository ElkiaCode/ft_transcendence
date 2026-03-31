import { S3Client } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';

dotenv.config(); // charge les variables du .env

export const s3Client = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT,     // ex: http://localhost:9000
  region: 'local',
  credentials: {
    accessKeyId: process.env.MINIO_ROOT_USER!,   
    secretAccessKey: process.env.MINIO_ROOT_PASSWORD!,
  },
  forcePathStyle: true,                      // obligatoire pour MinIO
});