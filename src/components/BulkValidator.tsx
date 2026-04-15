import React, { useState } from 'react';
import { LegalItem, ProductInput, ValidationResult } from '../types';
import { validateProducts } from '../lib/gemini';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Upload, Download, Loader2, FileSpreadsheet, CheckCircle2, AlertCircle, Search, Trash2 } from 'lucide-react';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import * as XLSX from 'xlsx';

interface BulkValidatorProps {
  bases: LegalItem[];
}

export function BulkValidator({ bases }: BulkValidatorProps) {
  const [products, setProducts] = useState<ProductInput[]>([]);
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

    const processData = (data: any[]) => {
      const parsedProducts: ProductInput[] = data.map((row: any) => {
        const keys = Object.keys(row).map(k => k.toLowerCase().trim());
        const rowLower: any = {};
        Object.keys(row).forEach(k => {
          rowLower[k.toLowerCase().trim()] = row[k];
        });

        let description = rowLower.descricao || rowLower.descrição || rowLower.descriçao || rowLower.description || rowLower.desc || rowLower.produto || rowLower.name || '';
        
        if (!description) {
          const descKey = Object.keys(rowLower).find(k => k.includes('desc') || k.includes('prod') || k.includes('item'));
          if (descKey) description = rowLower[descKey];
        }

        let codigo = rowLower.codigo || rowLower.id || rowLower.code || rowLower.cod || '';
        if (!codigo) {
          const codKey = Object.keys(rowLower).find(k => k === 'id' || k.includes('cod') || k.includes('sku'));
          if (codKey) codigo = rowLower[codKey];
        }

        let ncm = rowLower.ncm || rowLower.sh6 || '';
        if (!ncm) {
          const ncmKey = Object.keys(rowLower).find(k => k.includes('ncm'));
          if (ncmKey) ncm = rowLower[ncmKey];
        }

        return {
          codigo: String(codigo || '').trim(),
          description: String(description || '').trim(),
          ncm: String(ncm || '').trim(),
        };
      }).filter(p => p.description && p.description !== 'undefined' && p.description !== 'null' && p.description.length > 1);

      if (parsedProducts.length === 0) {
        toast.error("Nenhum produto válido encontrado. Verifique as colunas da planilha.");
      } else {
        setProducts(parsedProducts);
        setResults([]);
        toast.success(`${parsedProducts.length} produtos carregados.`);
      }
    };

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        processData(jsonData);
      };
      reader.readAsArrayBuffer(file);
    } else {
      // Handle CSV with dual encoding
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        Papa.parse(content, {
          header: true,
          skipEmptyLines: 'greedy',
          complete: (results) => {
            if (results.data.length > 0 && Object.keys(results.data[0]).length > 1) {
              processData(results.data);
            } else {
              // Try ISO-8859-1 if UTF-8 failed to produce multi-column data
              const readerIso = new FileReader();
              readerIso.onload = (e2) => {
                Papa.parse(e2.target?.result as string, {
                  header: true,
                  skipEmptyLines: 'greedy',
                  complete: (resIso) => processData(resIso.data)
                });
              };
              readerIso.readAsText(file, 'ISO-8859-1');
            }
          }
        });
      };
      reader.readAsText(file, 'UTF-8');
    }

    e.target.value = '';
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const processBatchWithRetry = async (batch: ProductInput[], retries = 3, delay = 2000): Promise<ValidationResult[]> => {
    try {
      return await validateProducts(batch, bases);
    } catch (error: any) {
      const isRateLimit = error?.message?.includes('429') || error?.status === 429 || JSON.stringify(error).includes('429');
      
      if (isRateLimit && retries > 0) {
        toast.warning(`Limite de requisições atingido. Reentando em ${delay/1000}s...`);
        await sleep(delay);
        return processBatchWithRetry(batch, retries - 1, delay * 2);
      }
      
      console.error("Batch processing error:", error);
      return batch.map(p => ({
        codigo: p.codigo,
        descricao: p.description,
        ncm: p.ncm,
        resultado_pr: 'REVISÃO MANUAL' as const,
        tipo_enquadramento: 'Não identificado',
        fundamento_legal: 'Erro na API (Quota)',
        interpretacao_aplicada: 'O limite de processamento da IA foi atingido. Tente novamente em instantes.',
        nivel_confianca: 'BAIXA' as const,
        status_final: 'ERRO',
        observacao_ajuste: 'Erro de Quota (429)'
      }));
    }
  };

  const handleProcess = async () => {
    if (products.length === 0 || bases.length === 0) return;

    setLoading(true);
    setResults([]);
    const batchSize = 3; // Reduced batch size for better stability
    const total = products.length;
    setProgress({ current: 0, total });

    const allResults: ValidationResult[] = [];

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      const batchResults = await processBatchWithRetry(batch);
      allResults.push(...batchResults);
      setProgress({ current: Math.min(i + batchSize, total), total });
      
      // Add a small delay between batches to avoid hitting rate limits too quickly
      if (i + batchSize < products.length) {
        await sleep(1000);
      }
    }

    setResults(allResults);
    setLoading(false);
    toast.success("Processamento concluído!");
  };

  const handleClear = () => {
    setProducts([]);
    setResults([]);
    setProgress({ current: 0, total: 0 });
    toast.info("Planilha removida.");
  };

  const handleExport = () => {
    if (results.length === 0) return;

    const csv = Papa.unparse(results);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `validacao_fiscal_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CESTA BÁSICA - ISENTO': return 'text-emerald-600 bg-emerald-50 border-emerald-100';
      case 'REDUÇÃO DE BASE - 7%': return 'text-blue-600 bg-blue-50 border-blue-100';
      case 'SEM BENEFÍCIO': return 'text-slate-600 bg-slate-50 border-slate-100';
      case 'REVISÃO MANUAL': return 'text-amber-600 bg-amber-50 border-amber-100';
      default: return 'text-slate-600 bg-slate-50 border-slate-100';
    }
  };

  return (
    <div className="bento-grid">
      {/* Control Card */}
      <div className="bento-card col-span-12 lg:col-span-4 row-span-4">
        <div className="bento-label">Controle de Processamento</div>
        <div className="space-y-6 flex-1 flex flex-col justify-center">
          <div className="relative group">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer z-20 w-full h-full"
            />
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center group-hover:border-primary transition-colors bg-muted/30 relative z-10">
              <FileSpreadsheet className="h-10 w-10 mx-auto mb-4 text-muted-foreground group-hover:text-primary transition-colors" />
              <p className="text-sm font-bold text-foreground">Carregar Planilha de Produtos</p>
              <p className="text-[10px] text-muted-foreground uppercase mt-1">Formato: CSV ou Excel (codigo, descrição, ncm)</p>
            </div>
          </div>

          <div className="space-y-3">
            <Button 
              onClick={handleProcess} 
              className="w-full h-12 bg-primary text-primary-foreground font-black text-sm rounded-xl shadow-lg shadow-primary/20"
              disabled={loading || products.length === 0 || bases.length === 0}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processando {progress.current}/{progress.total}
                </>
              ) : (
                <>
                  <Search className="mr-2 h-5 w-5" />
                  Iniciar Validação em Lote
                </>
              )}
            </Button>

            <Button 
              variant="outline" 
              onClick={handleExport} 
              className="w-full h-12 border-border font-bold text-sm rounded-xl"
              disabled={results.length === 0 || loading}
            >
              <Download className="mr-2 h-5 w-5" />
              Exportar Resultados (CSV)
            </Button>

            {products.length > 0 && !loading && (
              <Button 
                variant="ghost" 
                onClick={handleClear} 
                className="w-full h-10 text-destructive hover:text-destructive hover:bg-destructive/10 font-bold text-xs rounded-xl"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remover Planilha Atual
              </Button>
            )}
          </div>

          {bases.length === 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-lg text-[11px] text-amber-700 font-bold">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Atenção: Nenhuma base legal carregada. O processamento não será possível.</span>
            </div>
          )}
        </div>
      </div>

      {/* Results Table */}
      <div className="bento-card col-span-12 lg:col-span-8 row-span-8">
        <div className="flex items-center justify-between mb-4">
          <div className="bento-label">Resultados da Validação</div>
          {results.length > 0 && (
            <Badge className="bg-primary/10 text-primary border-primary/20 font-black">
              {results.length} ITENS PROCESSADOS
            </Badge>
          )}
        </div>
        
        <div className="flex-1 overflow-hidden border border-border rounded-xl bg-card/50">
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-20">
                <TableRow className="border-border">
                  <TableHead className="text-[10px] uppercase font-black tracking-widest w-[80px]">Cód.</TableHead>
                  <TableHead className="text-[10px] uppercase font-black tracking-widest">Descrição</TableHead>
                  <TableHead className="text-[10px] uppercase font-black tracking-widest">NCM</TableHead>
                  <TableHead className="text-[10px] uppercase font-black tracking-widest">Resultado PR</TableHead>
                  <TableHead className="text-[10px] uppercase font-black tracking-widest">Confiança</TableHead>
                  <TableHead className="text-[10px] uppercase font-black tracking-widest">Revisão</TableHead>
                </TableRow>
              </TableHeader>
                  <TableBody>
                {results.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-[400px] text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <FileSpreadsheet className="h-12 w-12 mb-4 opacity-10" />
                        <p className="font-bold uppercase tracking-widest text-xs">Aguardando processamento</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  results.map((res, i) => (
                    <TableRow key={i} className="border-border hover:bg-muted/30 transition-colors">
                      <TableCell className="font-mono text-[10px] font-bold text-muted-foreground">{res.codigo || '-'}</TableCell>
                      <TableCell className="font-bold text-foreground text-xs max-w-[200px] truncate" title={res.descricao}>
                        {res.descricao}
                      </TableCell>
                      <TableCell className="font-mono text-[10px] font-bold text-muted-foreground">{res.ncm}</TableCell>
                      <TableCell>
                        <Badge className={cn("text-[9px] font-black border px-2 py-0.5 rounded-md whitespace-nowrap", getStatusColor(res.resultado_pr))}>
                          {res.resultado_pr}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-[9px] font-black border-border", 
                          res.nivel_confianca === 'ALTA' ? 'text-emerald-600' : 
                          res.nivel_confianca === 'MÉDIA' ? 'text-amber-600' : 'text-red-600'
                        )}>
                          {res.nivel_confianca}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {res.observacao_ajuste ? (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[9px] font-black">AJUSTADO</Badge>
                        ) : (
                          <span className="text-[9px] text-muted-foreground font-bold">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="bento-card col-span-12 lg:col-span-4 row-span-4">
        <div className="bento-label">Resumo do Lote</div>
        {results.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Cesta Básica</p>
              <p className="text-2xl font-black text-emerald-700">
                {results.filter(r => r.resultado_pr === 'CESTA BÁSICA - ISENTO').length}
              </p>
            </div>
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Redução Base</p>
              <p className="text-2xl font-black text-blue-700">
                {results.filter(r => r.resultado_pr === 'REDUÇÃO DE BASE - 7%').length}
              </p>
            </div>
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
              <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Revisão Manual</p>
              <p className="text-2xl font-black text-amber-700">
                {results.filter(r => r.resultado_pr === 'REVISÃO MANUAL').length}
              </p>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Sem Benefício</p>
              <p className="text-2xl font-black text-slate-700">
                {results.filter(r => r.resultado_pr === 'SEM BENEFÍCIO').length}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center border-2 border-dashed border-border rounded-xl mt-4">
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Sem dados</p>
          </div>
        )}
      </div>
    </div>
  );
}
