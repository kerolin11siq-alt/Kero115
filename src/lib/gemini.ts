import { GoogleGenAI, Type } from "@google/genai";
import { LegalItem, ProductInput, ValidationResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_INSTRUCTION = `Você é um Auditor Fiscal Sênior especializado em ICMS no estado do Paraná.
Sua função é realizar uma análise fiscal rigorosa, seguida de uma REVISÃO e VALIDAÇÃO técnica dos enquadramentos.

OBJETIVO: Garantir segurança fiscal absoluta, evitando enquadramentos indevidos em benefícios.

PROCESSO DE ANÁLISE E REVISÃO (OBRIGATÓRIO):

ETAPA 1 — ANÁLISE INICIAL:
1. Interprete a descrição comercial vs. descrição legal (Anexos V e VI do RICMS/PR).
2. Verifique limitações (ex: "estado natural", "exceto", "uso industrial").
3. Defina o enquadramento inicial.

ETAPA 2 — REVISÃO CRÍTICA (AUTO-AUDITORIA):
1. Reavalie a decisão: O produto realmente atende a TODOS os requisitos da norma?
2. Verifique descaracterização: É um produto premium, gourmet, processado ou composto que foge do conceito de "alimento básico"?
3. Valide o fundamento: O item citado na legislação corresponde exatamente ao produto?
4. Se houver erro ou dúvida na análise inicial, CORRIJA e registre o motivo no campo "observacao_ajuste".

ETAPA 3 — VALIDAÇÃO TÉCNICA FINAL:
- O enquadramento é juridicamente defensável?
- O nível de confiança reflete a clareza da norma? (Dúvida = REVISÃO MANUAL).

REGRAS DE OURO:
- "estado natural" → não incluir processados.
- "linguiça" → validar se é a genérica ou elaborada (ex: recheada com queijo).
- Priorize a segurança do fisco: Em caso de dúvida, não conceda o benefício.

ORDEM DE DECISÃO:
1. CESTA BÁSICA (Anexo V) → "CESTA BÁSICA - ISENTO"
2. REDUÇÃO DE BASE (Anexo VI) → "REDUÇÃO DE BASE - 7%"
3. SEM BENEFÍCIO
4. REVISÃO MANUAL (Dúvida técnica)

Você deve retornar um objeto JSON contendo uma lista de resultados seguindo estritamente o esquema fornecido.`;

export async function validateProducts(
  products: ProductInput[],
  bases: LegalItem[]
): Promise<ValidationResult[]> {
  const prompt = `
Bases Legais (Contexto Legislativo):
${JSON.stringify(bases, null, 2)}

Produtos a analisar:
${JSON.stringify(products, null, 2)}

Realize a análise fiscal, seguida da revisão crítica e validação técnica. Retorne os resultados no formato JSON.
`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          results: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                codigo: { type: Type.STRING },
                descricao: { type: Type.STRING },
                ncm: { type: Type.STRING },
                resultado_pr: { 
                  type: Type.STRING, 
                  enum: ["CESTA BÁSICA - ISENTO", "REDUÇÃO DE BASE - 7%", "SEM BENEFÍCIO", "REVISÃO MANUAL"] 
                },
                tipo_enquadramento: { type: Type.STRING },
                fundamento_legal: { type: Type.STRING },
                interpretacao_aplicada: { type: Type.STRING },
                nivel_confianca: { type: Type.STRING, enum: ["ALTA", "MÉDIA", "BAIXA"] },
                status_final: { type: Type.STRING },
                observacao_ajuste: { type: Type.STRING }
              },
              required: ["descricao", "ncm", "resultado_pr", "tipo_enquadramento", "fundamento_legal", "interpretacao_aplicada", "nivel_confianca", "status_final"]
            }
          }
        },
        required: ["results"]
      }
    }
  });

  try {
    const parsed = JSON.parse(response.text || '{"results": []}');
    return (parsed.results || []) as ValidationResult[];
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    return products.map(p => ({
      codigo: p.codigo,
      descricao: p.description,
      ncm: p.ncm,
      resultado_pr: 'REVISÃO MANUAL',
      tipo_enquadramento: 'Não identificado',
      fundamento_legal: 'Erro no processamento',
      interpretacao_aplicada: 'Falha técnica na resposta da IA.',
      nivel_confianca: 'BAIXA',
      status_final: 'ERRO',
      observacao_ajuste: 'Erro no processamento'
    }));
  }
}

export async function extractLegalItemsFromText(
  text: string
): Promise<LegalItem[]> {
  const prompt = `
Abaixo está o conteúdo extraído de um documento legal (PDF ou Word) contendo tabelas ou listas de benefícios fiscais (Cesta Básica ou Redução de Base) do Paraná.

Conteúdo do Documento:
${text}

Sua tarefa é extrair todos os itens de benefício fiscal encontrados e estruturá-los como uma lista de objetos JSON.
Cada objeto deve ter:
- description: Descrição clara do produto ou grupo de produtos.
- ncm: NCM ou prefixo de NCM (se disponível).
- baseType: "CESTA_BASICA" ou "REDUCAO_BASE".
- legalFoundation: O fundamento legal (ex: Item 1 do Anexo V).
- observations: Observações relevantes (opcional).
- exclusions: Exclusões mencionadas (opcional).

Retorne APENAS o JSON no formato: {"items": [...]}
`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      systemInstruction: "Você é um especialista em extração de dados estruturados de documentos legais fiscais.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING },
                ncm: { type: Type.STRING },
                baseType: { type: Type.STRING, enum: ["CESTA_BASICA", "REDUCAO_BASE"] },
                legalFoundation: { type: Type.STRING },
                observations: { type: Type.STRING },
                exclusions: { type: Type.STRING }
              },
              required: ["description", "ncm", "baseType", "legalFoundation"]
            }
          }
        },
        required: ["items"]
      }
    }
  });

  try {
    const parsed = JSON.parse(response.text || '{"items": []}');
    return (parsed.items || []).map((item: any) => ({
      ...item,
      id: `extracted-${Math.random().toString(36).substr(2, 9)}`
    })) as LegalItem[];
  } catch (e) {
    console.error("Failed to parse extracted items", e);
    return [];
  }
}
