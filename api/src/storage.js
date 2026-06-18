import { config } from './config.js'
import { join, dirname, extname } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { createReadStream, existsSync } from 'node:fs'

// Storage-Backend: 'minio' (Object-Storage, web mode) ODER 'local' (Dateisystem
// unter localDataDir/branding, für die Electron-/Einzelplatz-App).
const LOCAL = config.storageMode === 'local'
const localRoot = join(config.localDataDir, 'branding')

const CONTENT_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

// MinIO-Client nur bei Bedarf laden (im local mode wird minio nie importiert).
let _minio = null
async function minioClient() {
  if (_minio) return _minio
  const { Client } = await import('minio')
  _minio = new Client({
    endPoint: config.minio.endPoint,
    port: config.minio.port,
    useSSL: config.minio.useSSL,
    accessKey: config.minio.accessKey,
    secretKey: config.minio.secretKey,
  })
  return _minio
}

// Bucket/Verzeichnis sicherstellen. Im Dev (MinIO) öffentlich lesbar machen.
export async function ensureBucket() {
  if (LOCAL) {
    await mkdir(localRoot, { recursive: true })
    return
  }
  const minio = await minioClient()
  const { bucket } = config.minio
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
  if (LOCAL) {
    const file = join(localRoot, key)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, buffer)
    return key
  }
  const minio = await minioClient()
  await minio.putObject(config.minio.bucket, key, buffer, buffer.length, { 'Content-Type': contentType })
  return key
}

// Objekt holen (Stream + Content-Type) — die API streamt es zum Browser.
export async function getObject(key) {
  if (LOCAL) {
    const file = join(localRoot, key)
    if (!existsSync(file)) throw new Error(`logo not found: ${key}`)
    return {
      stream: createReadStream(file),
      contentType: CONTENT_TYPES[extname(key).toLowerCase()] ?? 'application/octet-stream',
    }
  }
  const minio = await minioClient()
  const stat = await minio.statObject(config.minio.bucket, key)
  const stream = await minio.getObject(config.minio.bucket, key)
  return { stream, contentType: stat.metaData['content-type'] ?? 'application/octet-stream' }
}
