import { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromRequest } from '../creditGate.js';
import { enforceRateLimit } from '../rateLimit.js';
import { captureServerError } from '../sentry.js';

// A GENIUSS spoken reply is documented as 1-3 short sentences; this is a
// generous ceiling well above any legitimate reply, bounding per-call cost
// even from a compromised admin session (backend security audit, 2026-07-01).
const MAX_TTS_CHARS = 2000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // TTS is admin-only — verify the caller is the configured admin user.
  const userId = await getUserFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const adminId = process.env.ADMIN_USER_ID;
  if (!adminId || userId !== adminId) return res.status(403).json({ error: 'Forbidden' });

  // Not credit-gated (this is the admin's own tool, not a consumer feature),
  // but still rate-limited — this endpoint was previously completely ungated,
  // so a compromised admin session had no per-call cost backstop at all.
  const allowed = await enforceRateLimit(req, res, "tts", userId);
  if (!allowed) return;

  const { text, voiceId: requestedVoiceId } = req.body;
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }
  if (text.length > MAX_TTS_CHARS) {
    return res.status(400).json({ error: `text exceeds ${MAX_TTS_CHARS} characters` });
  }

  // Support both ELEVENLABS_API_KEY and ELEVENLABS_API_KEY_2 naming conventions
  const apiKey = process.env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY_2;

  // British "AI butler" voices — ElevenLabs default voices available to every
  // account, so GENIUSS sounds like JARVIS out of the box (no extra setup).
  const BRITISH_DANIEL = 'onwK4e9ZLuTAKqWW03F9'; // deep, authoritative British
  const BRITISH_GEORGE = 'JBFqnCBsd6RMkjVDRZzb'; // warm British

  // Any custom voices configured via env still work.
  const envVoice1 = process.env.ELEVENLABS_VOICE_ID || process.env.ELEVENLABS_VOICE_ID_1 || '';
  const envVoice2 = process.env.ELEVENLABS_VOICE_ID_2 || '';

  // Default to the British butler voice unless an explicit env default is set.
  const defaultVoice = process.env.ELEVENLABS_VOICE_ID || BRITISH_DANIEL;

  // Allowed voice IDs (whitelist to prevent abuse)
  const ALLOWED_VOICES = [BRITISH_DANIEL, BRITISH_GEORGE, envVoice1, envVoice2].filter(Boolean);
  const voiceId = ALLOWED_VOICES.includes(requestedVoiceId)
    ? requestedVoiceId
    : defaultVoice;

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
    captureServerError(error, 'tts', { userId });
    res.status(500).json({ error: error.message });
  }
}
