import React, { useState } from 'react';
import { LegalItem } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Upload, Trash2, Plus, FileJson, Loader2, FileText, FileCode } from 'lucide-react';
import Papa from 'papaparse';
import * as mammoth from 'mammoth';
import * as pdfjs from 'pdfjs-dist';
import * as XLSX from 'xlsx';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { extractLegalItemsFromText } from '../lib/gemini';
import { toast } from 'sonner';

// Set up PDF.js worker using Vite's worker loader
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

interface BaseManagerProps {
  bases: LegalItem[];
  setBases: React.Dispatch<React.SetStateAction<LegalItem[]>>;
}

export function BaseManager({ bases, setBases }: BaseManagerProps) {
  const [loading, setLoading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileType = file.name.split('.').pop()?.toLowerCase();

    if (fileType === 'csv' || fileType === 'xlsx' || fileType === 'xls') {
      const processData = (data: any[]) => {
        const newItems: LegalItem[] = data.map((row: any, index: number) => {
          const rowLower: any = {};
          Object.keys(row).forEach(k => {
            rowLower[k.toLowerCase().trim()] = row[k];
          });

          return {
            id: `import-${Date.now()}-${index}`,
            description: rowLower.description || rowLower.descricao || rowLower.descrição || rowLower.descriçao || rowLower.desc || '',
            ncm: String(rowLower.ncm || ''),
            baseType: (String(rowLower.basetype || rowLower.tipo || rowLower.tipo_base || ''))?.includes('CESTA') ? 'CESTA_BASICA' : 'REDUCAO_BASE' as 'CESTA_BASICA' | 'REDUCAO_BASE',
            legalFoundation: rowLower.legalfoundation || rowLower.fundamento || rowLower.base_legal || '',
            observations: rowLower.observations || rowLower.observacoes || '',
            exclusions: rowLower.exclusions || rowLower.exclusoes || '',
          };
        }).filter((item: any) => item.description);

        if (newItems.length === 0) {
          toast.error("Nenhum item válido encontrado na planilha.");
        } else {
          setBases(prev => [...prev, ...newItems]);
          toast.success(`${newItems.length} itens importados.`);
        }
      };

      if (fileType === 'csv') {
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
      } else {
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
      }
    } else if (fileType === 'docx') {
      setLoading(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        const text = result.value;
        const extracted = await extractLegalItemsFromText(text);
        setBases(prev => [...prev, ...extracted]);
        toast.success(`${extracted.length} itens extraídos do Word.`);
      } catch (error) {
        console.error("Word import error:", error);
        toast.error("Erro ao importar arquivo Word.");
      } finally {
        setLoading(false);
      }
    } else if (fileType === 'pdf') {
      setLoading(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const strings = content.items.map((item: any) => item.str);
          fullText += strings.join(' ') + '\n';
        }
        const extracted = await extractLegalItemsFromText(fullText);
        setBases(prev => [...prev, ...extracted]);
        toast.success(`${extracted.length} itens extraídos do PDF.`);
      } catch (error) {
        console.error("PDF import error:", error);
        toast.error("Erro ao importar arquivo PDF.");
      } finally {
        setLoading(false);
      }
    } else {
      toast.error("Formato de arquivo não suportado. Use CSV, PDF ou DOCX.");
    }
  };

  const removeBase = (id: string) => {
    setBases(prev => prev.filter(b => b.id !== id));
  };

  const clearAll = () => {
    setBases([]);
  };

  const loadExampleData = () => {
    const exampleData: LegalItem[] = [
      {
        id: 'ex1',
        description: 'Arroz polido',
        ncm: '1006.30.11',
        baseType: 'CESTA_BASICA',
        legalFoundation: 'RICMS/PR, Anexo II, Item 1',
        observations: 'Exceto arroz parboilizado',
      },
      {
        id: 'ex2',
        description: 'Feijão comum',
        ncm: '0713.33.19',
        baseType: 'CESTA_BASICA',
        legalFoundation: 'RICMS/PR, Anexo II, Item 2',
      },
      {
        id: 'ex3',
        description: 'Óleo de soja refinado',
        ncm: '1507.90.11',
        baseType: 'REDUCAO_BASE',
        legalFoundation: 'RICMS/PR, Anexo VI, Item 5',
      }
    ];
    setBases(prev => [...prev, ...exampleData]);
  };

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="bg-muted/50 border-b border-border">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-foreground font-black tracking-tight">Bases Legais</CardTitle>
              <CardDescription className="text-muted-foreground font-medium">
                Gerencie as tabelas de Cesta Básica e Redução de Base do Paraná.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={loadExampleData} className="border-border hover:bg-muted font-bold rounded-lg" disabled={loading}>
                <Plus className="mr-2 h-4 w-4" /> Exemplo
              </Button>
              <div className="relative">
                <input
                  type="file"
                  accept=".csv,.pdf,.docx,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full"
                  disabled={loading}
                />
                <Button variant="outline" size="sm" className="border-border hover:bg-muted font-bold rounded-lg" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Extraindo...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" /> Importar (CSV/PDF/Word)
                    </>
                  )}
                </Button>
              </div>
              <Button variant="destructive" size="sm" onClick={clearAll} disabled={bases.length === 0 || loading} className="font-bold rounded-lg">
                <Trash2 className="mr-2 h-4 w-4" /> Limpar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader className="bg-muted/30 sticky top-0 z-10">
                <TableRow className="border-border">
                  <TableHead className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Tipo</TableHead>
                  <TableHead className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Descrição Legal</TableHead>
                  <TableHead className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">NCM</TableHead>
                  <TableHead className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Fundamento</TableHead>
                  <TableHead className="text-[10px] uppercase font-black text-muted-foreground tracking-widest text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-20 text-muted-foreground font-bold italic">
                      Nenhuma base carregada. Importe um CSV ou adicione exemplos.
                    </TableCell>
                  </TableRow>
                ) : (
                  bases.map((base) => (
                    <TableRow key={base.id} className="border-border hover:bg-muted/50 transition-colors">
                      <TableCell>
                        <Badge variant={base.baseType === 'CESTA_BASICA' ? 'default' : 'secondary'} className="whitespace-nowrap font-bold rounded-md">
                          {base.baseType === 'CESTA_BASICA' ? 'Cesta Básica' : 'Red. Base'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-bold text-foreground">{base.description}</TableCell>
                      <TableCell className="font-mono text-muted-foreground font-bold text-xs">{base.ncm}</TableCell>
                      <TableCell className="text-muted-foreground text-[11px] font-semibold">{base.legalFoundation}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => removeBase(base.id)} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
