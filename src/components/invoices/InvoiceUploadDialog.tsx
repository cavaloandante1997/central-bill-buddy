import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Upload, FileText } from "lucide-react";
import * as pdfjsLib from 'pdfjs-dist';

// Set worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface InvoiceUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function InvoiceUploadDialog({ open, onOpenChange, onSuccess }: InvoiceUploadDialogProps) {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "application/pdf") {
        setFile(droppedFile);
      } else {
        toast.error("Por favor, carregue apenas ficheiros PDF");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === "application/pdf") {
        setFile(selectedFile);
      } else {
        toast.error("Por favor, carregue apenas ficheiros PDF");
      }
    }
  };

  const convertPdfToImage = async (pdfFile: File): Promise<string> => {
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    
    const scale = 2.0;
    const viewport = page.getViewport({ scale });
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    if (!context) throw new Error('Failed to get canvas context');
    
    await page.render({
      canvasContext: context,
      viewport: viewport,
    } as any).promise;
    
    return canvas.toDataURL('image/jpeg', 0.95);
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Por favor, selecione um ficheiro");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Utilizador não autenticado");
        setLoading(false);
        return;
      }

      console.log("Converting PDF to image for OCR...");
      const imageData = await convertPdfToImage(file);
      
      console.log("Calling AI to parse and categorize invoice...");
      const { data, error } = await supabase.functions.invoke("categorize-invoice", {
        body: {
          pdfData: imageData,
          fileName: file.name,
        },
      });

      if (error) {
        console.error("Error calling categorize function:", error);
        throw error;
      }

      console.log("AI categorization result:", data);

      if (data.error) {
        if (data.error.includes("Rate limits exceeded")) {
          toast.error("Limite de pedidos atingido. Por favor, tente novamente mais tarde.");
        } else if (data.error.includes("Payment required")) {
          toast.error("Créditos insuficientes. Por favor, adicione créditos à sua conta.");
        } else {
          toast.error("Erro ao processar: " + data.error);
        }
        setLoading(false);
        return;
      }

      // Check if there's a matching service
      const { data: services } = await supabase
        .from("services")
        .select("*")
        .eq("user_id", user.id)
        .ilike("issuer", `%${data.issuer}%`);

      let serviceId: string;

      if (services && services.length > 0) {
        // Use existing service and update logo if provided
        serviceId = services[0].id;
        
        if (data.logo_url && !services[0].logo_url) {
          await supabase
            .from("services")
            .update({ logo_url: data.logo_url })
            .eq("id", serviceId);
        }
        
        toast.success(`Fatura associada ao serviço existente: ${data.issuer}`);
      } else {
        // Create new service with logo
        const { data: newService, error: serviceError } = await supabase
          .from("services")
          .insert({
            user_id: user.id,
            issuer: data.issuer,
            category: data.category || null,
            logo_url: data.logo_url || null,
          })
          .select()
          .single();

        if (serviceError) throw serviceError;
        serviceId = newService.id;
        toast.success(`Novo serviço criado: ${data.issuer}`);
      }

      console.log("Creating invoice with Multibanco details:", data.parsed_fields);

      // Create invoice record with Multibanco details
      const { error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          service_id: serviceId,
          amount_cents: data.amount_cents || 0,
          due_date: data.due_date || new Date().toISOString().split('T')[0],
          issue_date: data.issue_date || null,
          parsed_fields: data.parsed_fields || {},
          status: "pending",
        });

      if (invoiceError) throw invoiceError;

      toast.success("Fatura processada com sucesso!");
      onOpenChange(false);
      onSuccess();
      setFile(null);
    } catch (error: any) {
      console.error("Error processing invoice:", error);
      toast.error("Erro ao processar fatura");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Carregar Fatura
            <Upload className="h-5 w-5 text-primary" />
          </DialogTitle>
          <DialogDescription>
            Carregue uma fatura em PDF. A IA irá categorizá-la automaticamente e criar ou associar a um serviço existente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {file ? (
              <div className="space-y-2">
                <FileText className="h-12 w-12 mx-auto text-primary" />
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFile(null)}
                  disabled={loading}
                >
                  Remover
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Arraste e solte um ficheiro PDF aqui, ou
                </p>
                <Label htmlFor="file-upload">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <span>Selecionar Ficheiro</span>
                  </Button>
                </Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleUpload} disabled={loading || !file}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                A processar...
              </>
            ) : (
              "Carregar e Processar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}