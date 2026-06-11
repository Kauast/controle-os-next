import Anthropic from '@anthropic-ai/sdk';
import { logger } from './logger';

const apiKey = process.env.ANTHROPIC_API_KEY;

// Modelo padrão: Claude Opus 4.8 (mais capaz). Sobrescreva via ANTHROPIC_MODEL.
export const AI_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-8';

// Em produção a chave é obrigatória; em dev o recurso de IA fica desabilitado
// (endpoints respondem 503) para não bloquear o boot sem a chave.
if (!apiKey) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ANTHROPIC_API_KEY não definida. Configure-a antes de iniciar em produção.');
  }
  logger.warn({ event: 'ai_disabled' }, 'ANTHROPIC_API_KEY ausente — recursos de IA desabilitados');
}

export const anthropic = apiKey ? new Anthropic({ apiKey }) : null;
export const aiEnabled = anthropic !== null;
