/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { LegalItem } from './types';
import { BaseManager } from './components/BaseManager';
import { ValidatorForm } from './components/ValidatorForm';
import { BulkValidator } from './components/BulkValidator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Toaster } from './components/ui/sonner';
import { ShieldCheck, Database, FileSearch, Info, FileSpreadsheet } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [bases, setBases] = useState<LegalItem[]>([]);
  const [activeTab, setActiveTab] = useState('validator');

  // Load bases from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('fiscal-bases');
    if (saved) {
      try {
        setBases(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load bases from localStorage", e);
      }
    }
  }, []);

  // Save bases to localStorage on change
  useEffect(() => {
    localStorage.setItem('fiscal-bases', JSON.stringify(bases));
  }, [bases]);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary selection:text-primary-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-lg">
              <ShieldCheck className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-primary uppercase">Tax Validator PR</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Legislação Atualizada: 2024.Q3</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-4 py-1.5 rounded-full bg-muted border border-border">
              <Database className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground">{bases.length} itens na base</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <TabsList className="bg-border/50 border border-border p-1 rounded-xl">
              <TabsTrigger value="validator" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <FileSearch className="h-4 w-4 mr-2" />
                Individual
              </TabsTrigger>
              <TabsTrigger value="bulk" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Em Lote
              </TabsTrigger>
              <TabsTrigger value="bases" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <Database className="h-4 w-4 mr-2" />
                Bases Legais
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground bg-card px-4 py-2 rounded-xl border border-border shadow-sm">
              <Info className="h-3.5 w-3.5 text-primary" />
              <span>Análise baseada exclusivamente nas tabelas carregadas.</span>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <TabsContent value="validator" key="validator">
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <ValidatorForm bases={bases} />
              </motion.div>
            </TabsContent>

            <TabsContent value="bulk" key="bulk">
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <BulkValidator bases={bases} />
              </motion.div>
            </TabsContent>

            <TabsContent value="bases" key="bases">
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <BaseManager bases={bases} setBases={setBases} />
              </motion.div>
            </TabsContent>
          </AnimatePresence>
        </Tabs>
      </main>

      <Toaster position="bottom-right" />
    </div>
  );
}

