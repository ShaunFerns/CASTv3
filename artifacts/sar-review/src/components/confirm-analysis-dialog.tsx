import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

const CONFIRMATION_PHRASE = "RUN ANALYSIS";

interface ConfirmAnalysisDialogProps {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ConfirmAnalysisDialog({
  open,
  title,
  description,
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmAnalysisDialogProps) {
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    if (!open) setInputValue("");
  }, [open]);

  const confirmed = inputValue === CONFIRMATION_PHRASE;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !isLoading) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#003865]">{title}</DialogTitle>
          <DialogDescription className="text-slate-600">{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <p className="text-sm text-slate-500">
            This action calls the AI and may take a moment. Type{" "}
            <span className="font-mono font-semibold text-[#003865] bg-blue-50 px-1 rounded">
              {CONFIRMATION_PHRASE}
            </span>{" "}
            to confirm.
          </p>
          <div className="space-y-1">
            <Label htmlFor="confirm-phrase" className="text-sm">
              Confirmation phrase
            </Label>
            <Input
              id="confirm-phrase"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={CONFIRMATION_PHRASE}
              className="font-mono"
              autoFocus
              disabled={isLoading}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!confirmed || isLoading}
            className="text-white hover:opacity-90"
            style={{ backgroundColor: confirmed ? "#003865" : undefined }}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Running…
              </>
            ) : (
              "Run Analysis"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
