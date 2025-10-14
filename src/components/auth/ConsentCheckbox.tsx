import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface ConsentCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function ConsentCheckbox({ checked, onCheckedChange }: ConsentCheckboxProps) {
  return (
    <div className="flex items-start space-x-2">
      <Checkbox
        id="consent"
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
      <Label
        htmlFor="consent"
        className="text-sm text-muted-foreground leading-relaxed cursor-pointer"
      >
        Autorizo a CentralPay PT a processar os meus emails de faturação e anexos,
        extrair dados de pagamento, e iniciar pagamentos através de Prestadores de
        Serviços de Pagamento licenciados em meu nome. A CentralPay PT não custódia
        os meus fundos.
      </Label>
    </div>
  );
}
