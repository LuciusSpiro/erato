import { Client } from 'minio'
import { config } from './config.js'

export const minio = new Client({
  endPoint: config.minio.endPoint,
  port: config.minio.port,
  useSSL: config.minio.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
})

const { bucket } = config.minio

// Bucket sicherstellen + im Dev öffentlich lesbar machen (Logos werden direkt
// per URL ausgeliefert). In Produktion stattdessen signierte URLs verwenden.
export async function ensureBucket() {
  const exists = await minio.bucketExists(bucket).catch(() => false)
  if (!exists) await minio.makeBucket(bucket)

  const policy = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${bucket}/*`],
      },
    ],
  }
  await minio.setBucketPolicy(bucket, JSON.stringify(policy)).catch(() => {})
}

export async function putLogo(key, buffer, contentType) {
  await minio.putObject(bucket, key, buffer, buffer.length, { 'Content-Type': contentType })
  return key
}

// Objekt aus MinIO holen (Stream + Content-Type) — die API streamt es zum Browser,
// damit Logo-Auslieferung nicht von Host→MinIO-Direktzugriff abhängt.
export async function getObject(key) {
  const stat = await minio.statObject(bucket, key)
  const stream = await minio.getObject(bucket, key)
  return { stream, contentType: stat.metaData['content-type'] ?? 'application/octet-stream' }
}
