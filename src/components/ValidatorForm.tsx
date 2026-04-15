import React, { useState } from 'react';
import { ProductInput, ValidationResult, LegalItem } from '../types';
import { validateProducts } from '../lib/gemini';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Search, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';

interface ValidatorFormProps {
  bases: LegalItem[];
}

export function ValidatorForm({ bases }: ValidatorFormProps) {
  const [product, setProduct] = useState<ProductInput>({ description: '', ncm: '' });
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleValidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product.description || bases.length === 0) return;

    setLoading(true);
    try {
      const res = await validateProducts([product], bases);
      setResult(res[0] || null);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'CESTA BÁSICA - ISENTO': return 'bg-emerald-100 text-emerald-600 border-emerald-200';
      case 'REDUÇÃO DE BASE - 7%': return 'bg-blue-100 text-blue-600 border-blue-200';
      case 'REVISÃO MANUAL': return 'bg-amber-100 text-amber-600 border-amber-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getConfidenceColor = (level: string) => {
    switch (level) {
      case 'ALTA': return 'border-t-emerald-500 text-emerald-600';
      case 'MÉDIA': return 'border-t-amber-500 text-amber-600';
      case 'BAIXA': return 'border-t-red-500 text-red-600';
      default: return 'border-t-slate-300 text-slate-600';
    }
  };

  return (
    <div className="bento-grid">
      {/* Input Area */}
      <div className="bento-card col-span-12 lg:col-span-8 row-span-2">
        <div className="bento-label">Analisar Descrição do Produto</div>
        <form onSubmit={handleValidate} className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 space-y-2">
            <Input
              id="description"
              placeholder="Ex: ARROZ TIPO 1 - PACOTE 5KG (POLIDO)"
              value={product.description}
              onChange={(e) => setProduct(prev => ({ ...prev, description: e.target.value }))}
              className="bg-muted border-border text-foreground h-12 text-lg font-medium"
            />
          </div>
          <div className="w-full md:w-48 space-y-2">
            <Input
              id="ncm"
              placeholder="NCM (Opcional)"
              value={product.ncm}
              onChange={(e) => setProduct(prev => ({ ...prev, ncm: e.target.value }))}
              className="bg-muted border-border text-foreground h-12 font-mono"
            />
          </div>
          <Button 
            type="submit" 
            className="h-12 px-8 bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
            disabled={loading || !product.description || bases.length === 0}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
          </Button>
        </form>
        {bases.length === 0 && (
          <p className="text-xs text-warning mt-2 flex items-center font-semibold">
            <AlertCircle className="h-3.5 w-3.5 mr-1" />
            Carregue as bases legais antes de validar.
          </p>
        )}
      </div>

      {/* Summary Area */}
      <div className="bento-card col-span-12 lg:col-span-4 row-span-5 items-center justify-center text-center">
        {!result && !loading ? (
          <div className="flex flex-col items-center justify-center text-muted-foreground py-12">
            <Search className="h-16 w-16 mb-4 opacity-10" />
            <p className="font-medium">Aguardando análise...</p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center text-muted-foreground py-12">
            <Loader2 className="h-16 w-16 mb-4 animate-spin opacity-20" />
            <p className="animate-pulse font-bold">Consultando Legislação...</p>
          </div>
        ) : result ? (
          <div className="animate-in fade-in zoom-in duration-500 w-full">
            <Badge className={cn("mb-4 px-4 py-1.5 rounded-full border text-xs font-bold", getStatusBadgeClass(result.resultado_pr))}>
              {result.resultado_pr}
            </Badge>
            <div className="bento-label">Resultado PR</div>
            <h2 className="text-3xl font-black tracking-tighter text-foreground mb-2 leading-none uppercase">
              {result.resultado_pr.split(' - ')[0]}
            </h2>
            <div className="text-sm font-semibold text-muted-foreground">
              Status: <span className={cn("font-black", result.status_final.includes('ERRO') ? 'text-destructive' : 'text-success')}>
                {result.status_final}
              </span>
            </div>
            <div className="text-[10px] uppercase font-black text-muted-foreground mt-2 tracking-widest">
              Enquadramento: {result.tipo_enquadramento}
            </div>
          </div>
        ) : null}
      </div>

      {/* Detail Area */}
      <div className="bento-card col-span-12 lg:col-span-5 row-span-5">
        <div className="bento-label">Detalhamento da Análise</div>
        {result ? (
          <div className="space-y-6 flex-1 flex flex-col">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border/50">
                <tr>
                  <td className="py-3 text-muted-foreground font-medium">NCM Informada</td>
                  <td className="py-3 text-right font-mono text-foreground font-bold">
                    <span className="bg-muted px-2 py-1 rounded border border-border text-[11px]">
                      {result.ncm || 'N/A'}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 text-muted-foreground font-medium">Fundamento Legal</td>
                  <td className="py-3 text-right text-foreground font-bold leading-tight max-w-[200px]">
                    {result.fundamento_legal}
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="mt-auto space-y-4">
              <div>
                <div className="bento-label">Interpretação Aplicada</div>
                <div className="bg-muted p-4 rounded-xl text-sm leading-relaxed text-muted-foreground font-medium border border-border italic">
                  {result.interpretacao_aplicada}
                </div>
              </div>
              {result.observacao_ajuste && (
                <div className="animate-in slide-in-from-bottom-2 duration-500">
                  <div className="bento-label text-warning">Observação de Ajuste (Revisão)</div>
                  <div className="bg-amber-50/50 p-4 rounded-xl text-sm leading-relaxed text-amber-700 font-bold border border-amber-100">
                    {result.observacao_ajuste}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center border-2 border-dashed border-border rounded-xl">
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Dados não disponíveis</p>
          </div>
        )}
      </div>

      {/* History Area (Placeholder for visual) */}
      <div className="bento-card col-span-12 lg:col-span-3 row-span-5">
        <div className="bento-label">Histórico Recente</div>
        <div className="space-y-1">
          {[
            { name: 'Arroz Polido 5kg', type: 'CESTA', color: 'text-primary' },
            { name: 'Óleo de Soja 900ml', type: 'REDUÇÃO', color: 'text-blue-500' },
            { name: 'Sabonete em Barra', type: 'REDUÇÃO', color: 'text-blue-500' },
            { name: 'Vinho Tinto 750ml', type: 'SEM ENQ.', color: 'text-muted-foreground' },
            { name: 'Leite Longa Vida', type: 'CESTA', color: 'text-primary' },
          ].map((item, i) => (
            <div key={i} className="flex justify-between items-center py-2.5 border-b border-border/50 last:border-0">
              <span className="text-xs font-semibold text-foreground truncate max-w-[140px]">{item.name}</span>
              <span className={cn("text-[10px] font-black", item.color)}>{item.type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Confidence Area */}
      <div className="bento-card col-span-12 lg:col-span-4 row-span-5 items-center justify-center text-center">
        <div className="bento-label">Nível de Confiança</div>
        {result ? (
          <>
            <div className={cn("confidence-circle", getConfidenceColor(result.nivel_confianca))}>
              <span className="text-3xl font-black tracking-tighter">
                {result.nivel_confianca === 'ALTA' ? '98%' : result.nivel_confianca === 'MÉDIA' ? '75%' : '40%'}
              </span>
            </div>
            <div className="mt-4">
              <div className={cn("text-lg font-black", result.nivel_confianca === 'ALTA' ? 'text-success' : result.nivel_confianca === 'MÉDIA' ? 'text-warning' : 'text-destructive')}>
                {result.nivel_confianca.toUpperCase()}
              </div>
              <div className="text-[11px] text-muted-foreground font-bold uppercase tracking-wide mt-1">
                {result.nivel_confianca === 'ALTA' ? 'Interpretação fiscal direta' : 'Necessita revisão por especialista'}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12">
            <ShieldCheck className="h-16 w-16 mb-4 opacity-10" />
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Aguardando Análise</p>
          </div>
        )}
      </div>

      {/* Stats Area */}
      <div className="bento-card col-span-12 lg:col-span-3 row-span-3">
        <div className="bento-label">Performance do Lote</div>
        <div className="space-y-4 mt-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-muted-foreground">Total Analisado</span>
            <span className="text-lg font-black text-foreground">1.240</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-muted-foreground">Assertividade</span>
            <span className="text-lg font-black text-success">94.2%</span>
          </div>
        </div>
      </div>

      {/* Legal Ref Area */}
      <div className="bento-card col-span-12 lg:col-span-5 row-span-3">
        <div className="bento-label">Fundamentação Legal (Consulta Rápida)</div>
        <div className="text-[11px] leading-relaxed text-muted-foreground font-medium">
          <p className="mb-2"><strong className="text-foreground">Item 1:</strong> Arroz, feijão, banha de porco, leite em pó, café, sal de cozinha...</p>
          <p className="mb-2"><strong className="text-foreground">Item 5:</strong> Redução de base de cálculo para produtos de higiene pessoal...</p>
          <p className="italic mt-4 opacity-60">* Baseada no Decreto n.º 7.871/2017 e atualizações.</p>
        </div>
      </div>
    </div>
  );
}
