import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { anthropic, AI_MODEL } from '../lib/anthropic';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';
import { aiRequestDuration, aiRequestsTotal, aiTokensTotal } from '../lib/metrics';

// Entrada: descrição livre do problema relatado pelo cliente.
export const triageInputSchema = z.object({
  description: z.string().min(10, 'Descrição muito curta para triagem (mínimo 10 caracteres)').max(4000),
});
export type TriageInput = z.infer<typeof triageInputSchema>;

// Saída estruturada validada — espelha o enum Priority do schema Prisma.
export const triageResultSchema = z.object({
  summary: z.string(),
  suggestedPriority: z.enum(['NORMAL', 'WARNING', 'HIGH']),
  suggestedTeam: z.string(),
  reasoning: z.string(),
});
export type TriageResult = z.infer<typeof triageResultSchema>;

// JSON Schema enviado à API para forçar o formato da resposta (structured outputs).
const TRIAGE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'Resumo objetivo do problema em uma única frase.' },
    suggestedPriority: {
      type: 'string',
      enum: ['NORMAL', 'WARNING', 'HIGH'],
      description: 'Prioridade sugerida para a ordem de serviço.',
    },
    suggestedTeam: {
      type: 'string',
      description: 'Equipe sugerida para atender (ex.: "Instalação", "Manutenção", "Suporte Remoto").',
    },
    reasoning: { type: 'string', description: 'Justificativa curta da priorização escolhida.' },
  },
  required: ['summary', 'suggestedPriority', 'suggestedTeam', 'reasoning'],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `Você é um assistente de triagem de ordens de serviço de uma empresa de rastreamento e monitoramento veicular.
A partir da descrição do problema relatado, produza uma triagem objetiva.

Critérios de prioridade:
- HIGH: veículo parado/sem rastreamento, falha de segurança, cliente bloqueado por inadimplência crítica, risco de perda do bem.
- WARNING: degradação intermitente, bateria do rastreador baixa, atraso de sinal, problema que pode escalar se não atendido.
- NORMAL: dúvidas, ajustes de cadastro, instalações agendadas, manutenções preventivas.

Responda sempre em português, de forma concisa e técnica.`;

export class AiService {
  /**
   * Classifica uma OS a partir da descrição livre, retornando prioridade,
   * resumo, equipe sugerida e justificativa — tudo validado contra o schema.
   */
  async triageServiceOrder(input: TriageInput): Promise<TriageResult> {
    if (!anthropic) {
      throw new AppError('Recurso de IA indisponível: ANTHROPIC_API_KEY não configurada.', 503);
    }

    const start = process.hrtime.bigint();
    try {
      const response = await anthropic.messages.create({
        model: AI_MODEL,
        max_tokens: 1024,
        // Tarefa de classificação curta e latência-sensível: thinking desligado.
        // A saída estruturada garante que a resposta siga o schema.
        thinking: { type: 'disabled' },
        system: SYSTEM_PROMPT,
        output_config: { format: { type: 'json_schema', schema: TRIAGE_JSON_SCHEMA } },
        messages: [
          { role: 'user', content: `Descrição da OS:\n\n${input.description}` },
        ],
      });

      // Classificadores de segurança podem recusar (HTTP 200, stop_reason "refusal").
      if (response.stop_reason === 'refusal') {
        aiRequestsTotal.inc({ operation: 'triage', outcome: 'refusal' });
        throw new AppError('A IA recusou processar esta descrição.', 422);
      }

      const textBlock = response.content.find((b: { type: string }) => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        throw new AppError('Resposta da IA sem conteúdo de texto.', 502);
      }

      const result = triageResultSchema.parse(JSON.parse(textBlock.text));

      const seconds = Number(process.hrtime.bigint() - start) / 1e9;
      aiRequestDuration.observe({ operation: 'triage', outcome: 'success' }, seconds);
      aiRequestsTotal.inc({ operation: 'triage', outcome: 'success' });
      aiTokensTotal.inc({ operation: 'triage', direction: 'input' }, response.usage.input_tokens);
      aiTokensTotal.inc({ operation: 'triage', direction: 'output' }, response.usage.output_tokens);
      logger.info(
        {
          event: 'ai_triage',
          model: AI_MODEL,
          durationMs: Math.round(seconds * 1000),
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          priority: result.suggestedPriority,
        },
        'ai_triage'
      );
      return result;
    } catch (err) {
      if (err instanceof AppError) throw err;

      aiRequestsTotal.inc({ operation: 'triage', outcome: 'error' });

      if (err instanceof Anthropic.APIError) {
        logger.error(
          { event: 'ai_triage_api_error', status: err.status, type: err.type, message: err.message },
          'Erro na API de IA'
        );
        if (err instanceof Anthropic.RateLimitError) {
          throw new AppError('Serviço de IA sobrecarregado. Tente novamente em instantes.', 429);
        }
        throw new AppError('Falha na comunicação com o serviço de IA.', 502);
      }

      logger.error({ event: 'ai_triage_failed', err }, 'Falha inesperada na triagem por IA');
      throw new AppError('Falha ao processar triagem por IA.', 502);
    }
  }
}
