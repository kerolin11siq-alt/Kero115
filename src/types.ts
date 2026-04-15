export interface LegalItem {
  id: string;
  description: string;
  ncm: string;
  baseType: 'CESTA_BASICA' | 'REDUCAO_BASE';
  legalFoundation: string;
  observations?: string;
  exclusions?: string;
}

export interface ProductInput {
  codigo?: string;
  description: string;
  ncm: string;
}

export interface ValidationResult {
  codigo?: string;
  descricao: string;
  ncm: string;
  resultado_pr: 'CESTA BÁSICA - ISENTO' | 'REDUÇÃO DE BASE - 7%' | 'SEM BENEFÍCIO' | 'REVISÃO MANUAL';
  tipo_enquadramento: string;
  fundamento_legal: string;
  interpretacao_aplicada: string;
  nivel_confianca: 'ALTA' | 'MÉDIA' | 'BAIXA';
  status_final: string;
  observacao_ajuste?: string;
}
