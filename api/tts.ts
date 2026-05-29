import { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromRequest } from '../server/creditGate.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // TTS is admin-only — verify the caller is the configured admin user.
  const userId = await getUserFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const adminId = process.env.ADMIN_USER_ID;
  if (!adminId || userId !== adminId) return res.status(403).json({ error: 'Forbidden' });

  const { text, voiceId: requestedVoiceId } = req.body;

  // Support both ELEVENLABS_API_KEY and ELEVENLABS_API_KEY_2 naming conventions
  const apiKey = process.env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY_2;

  // Resolve voice IDs from env vars (supports _2 suffix naming convention)
  const voice1 = process.env.ELEVENLABS_VOICE_ID || process.env.ELEVENLABS_VOICE_ID_1 || '8Ln42OXYupYsag45MAUy';
  const voice2 = process.env.ELEVENLABS_VOICE_ID_2 || 'bbGtsRRKUfYO634UxSjz';

  // Allowed voice IDs (whitelist to prevent abuse)
  const ALLOWED_VOICES = [voice1, voice2];
  const voiceId = ALLOWED_VOICES.includes(requestedVoiceId)
    ? requestedVoiceId
    : voice1;

  if (!apiKey) {
    return res.status(500).json({ error: 'ElevenLabs API key not configured' });
  }

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2',
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.80,
          style: 0.3,
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} ${errText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.send(buffer);
  } catch (error: any) {
    console.error('TTS error:', error);
    res.status(500).json({ error: error.message });
  }
}
