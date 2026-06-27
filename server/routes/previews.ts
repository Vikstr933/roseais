import { Router } from 'express';
import { previewService } from '../services/PreviewService';
import { authenticateUser } from '../middleware/auth';

const router = Router();

function getBaseUrl(req: any): string {
  const configured = process.env.PUBLIC_API_URL || process.env.API_BASE_URL || process.env.RENDER_EXTERNAL_URL;
  if (configured) return configured;

  const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
  const host = req.get('x-forwarded-host') || req.get('host');
  return `${proto}://${host}`;
}

function getFrameAncestors(): string {
  const origins = [
    "'self'",
    process.env.FRONTEND_URL,
    process.env.CLIENT_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
    'https://ais-rose.vercel.app',
  ].filter(Boolean);

  return Array.from(new Set(origins)).join(' ');
}

function setPreviewHeaders(res: any): void {
  res.removeHeader('X-Frame-Options');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self' data: blob: https:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https: wss: ws:",
      "media-src 'self' blob: https:",
      "object-src 'none'",
      "base-uri 'self'",
      `frame-ancestors ${getFrameAncestors()}`,
    ].join('; ')
  );
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
}

router.get('/:id/app', async (req, res) => {
  try {
    const asset = await previewService.resolveAsset(req.params.id, 'index.html');
    if (!asset) {
      return res.status(404).send('Preview not found');
    }

    setPreviewHeaders(res);
    return res.sendFile(asset.filePath);
  } catch (error) {
    console.error('Failed to serve preview root:', error);
    return res.status(500).send('Preview failed');
  }
});

router.get('/:id/app/*', async (req, res) => {
  try {
    const requestPath = String((req.params as Record<string, string | undefined>)[0] || '');
    const asset = await previewService.resolveAsset(req.params.id, requestPath);
    if (!asset) {
      return res.status(404).send('Preview not found');
    }

    setPreviewHeaders(res);
    return res.sendFile(asset.filePath);
  } catch (error) {
    console.error('Failed to serve preview asset:', error);
    return res.status(500).send('Preview failed');
  }
});

router.post('/', authenticateUser, async (req, res) => {
  try {
    const projectId = req.body.projectId === undefined || req.body.projectId === null
      ? null
      : Number(req.body.projectId);

    if (projectId !== null && !Number.isFinite(projectId)) {
      return res.status(400).json({ error: 'Invalid projectId' });
    }

    const session = await previewService.createPreview({
      userId: req.user!.id,
      projectId,
      files: Array.isArray(req.body.files) ? req.body.files : undefined,
      componentName: req.body.componentName,
      baseUrl: getBaseUrl(req),
    });

    return res.status(202).json({
      id: session.id,
      status: session.status,
      previewUrl: session.previewUrl,
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    console.error('Failed to create preview:', error);
    return res.status(500).json({
      error: 'Failed to create preview',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/:id', authenticateUser, async (req, res) => {
  try {
    const session = await previewService.getSession(req.params.id, req.user!.id);
    if (!session) {
      return res.status(404).json({ error: 'Preview not found' });
    }

    return res.json({
      id: session.id,
      projectId: session.projectId,
      status: session.status,
      previewUrl: session.previewUrl,
      logs: session.logs || [],
      errorMessage: session.errorMessage,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    });
  } catch (error) {
    console.error('Failed to get preview:', error);
    return res.status(500).json({ error: 'Failed to get preview' });
  }
});

router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const deleted = await previewService.deleteSession(req.params.id, req.user!.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Preview not found' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete preview:', error);
    return res.status(500).json({ error: 'Failed to delete preview' });
  }
});

export default router;
