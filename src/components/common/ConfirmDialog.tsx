import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShieldAlert, CheckCircle, AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  variant?: 'danger' | 'success' | 'warning';
}

export function ConfirmDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Annuler',
  onConfirm,
  variant = 'warning',
}: ConfirmDialogProps) {
  const getIcon = () => {
    switch (variant) {
      case 'danger':
        return <ShieldAlert className="h-8 w-8 text-red-500 animate-bounce" />;
      case 'success':
        return <CheckCircle className="h-8 w-8 text-teal-600 animate-pulse" />;
      case 'warning':
      default:
        return <AlertTriangle className="h-8 w-8 text-amber-500" />;
    }
  };

  const getIconBg = () => {
    switch (variant) {
      case 'danger':
        return 'bg-red-50 border border-red-100 shadow-md shadow-red-100/50';
      case 'success':
        return 'bg-teal-50 border border-teal-100 shadow-md shadow-teal-100/50';
      case 'warning':
      default:
        return 'bg-amber-50 border border-amber-100 shadow-md shadow-amber-100/50';
    }
  };

  const getConfirmButtonClass = () => {
    switch (variant) {
      case 'danger':
        return 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-md shadow-red-200/50 border-none transition-all duration-200 active:scale-95';
      case 'success':
        return 'bg-gradient-to-r from-[#037265] to-[#049484] hover:from-[#026156] hover:to-[#037f71] text-white shadow-md shadow-teal-200/50 border-none transition-all duration-200 active:scale-95';
      case 'warning':
      default:
        return 'bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white shadow-md shadow-amber-200/50 border-none transition-all duration-200 active:scale-95';
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent
        style={{ padding: '48px 40px 40px 40px' }}
        className="max-w-[500px] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-100/80 animate-in fade-in-50 zoom-in-95 duration-200"
      >
        <AlertDialogHeader className="flex flex-col items-center text-center space-y-5">
          <div className={`p-4 rounded-full flex items-center justify-center transition-transform hover:scale-110 duration-300 ${getIconBg()}`}>
            {getIcon()}
          </div>
          <div className="space-y-3">
            <AlertDialogTitle className="text-2xl font-bold tracking-tight text-slate-800 bg-gradient-to-b from-slate-900 to-slate-700 bg-clip-text text-transparent">
              {title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 text-sm leading-relaxed px-2 font-medium">
              {description}
            </AlertDialogDescription>
          </div>
        </AlertDialogHeader>
        
        <AlertDialogFooter className="flex flex-row items-center justify-between gap-4 mt-8 sm:flex-row sm:justify-between sm:space-x-0 w-full">
          <AlertDialogCancel className="flex-1 h-11 px-0 border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 hover:text-slate-800 hover:border-slate-300 transition-all duration-200 rounded-xl active:scale-[0.98]">
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={`flex-1 h-11 px-0 font-semibold rounded-xl transition-all duration-200 active:scale-[0.98] ${getConfirmButtonClass()}`}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
