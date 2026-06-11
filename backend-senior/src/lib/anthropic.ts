import Anthropic from '@anthropic-ai/sdk';
import { logger } from './logger';

const apiKey = process.env.ANTHROPIC_API_KEY;

// Modelo padrão: Claude Opus 4.8 (mais capaz). Sobrescreva via ANTHROPIC_MODEL.
export const AI_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-8';

// Em produção sem chave, IA fica desabilitada (endpoints respondem 503)
// sem bloquear o boot do servidor.
if (!apiKey) {
  logger.warn({ event: 'ai_disabled' }, 'ANTHROPIC_API_KEY ausente — recursos de IA desabilitados');
}

export const anthropic = apiKey ? new Anthropic({ apiKey }) : null;
export const aiEnabled = anthropic !== null;
