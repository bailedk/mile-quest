import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { TouchButton } from '@/components/mobile/TouchInteractions';

interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  isDestructive?: boolean;
  isLoading?: boolean;
}

export const AlertDialog: React.FC<AlertDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  isDestructive = false,
  isLoading = false,
}) => {
  const handleConfirm = async () => {
    await onConfirm();
    if (!isLoading) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 w-[90vw] max-w-md z-50">
          <Dialog.Title className="text-lg font-semibold text-gray-900 mb-2">
            {title}
          </Dialog.Title>
          <Dialog.Description className="text-gray-600 mb-6">
            {description}
          </Dialog.Description>
          
          <div className="flex gap-3 justify-end">
            <TouchButton
              variant="ghost"
              onPress={() => onOpenChange(false)}
              disabled={isLoading}
            >
              {cancelText}
            </TouchButton>
            <TouchButton
              variant={isDestructive ? 'primary' : 'primary'}
              className={isDestructive ? 'bg-red-600 hover:bg-red-700' : ''}
              onPress={handleConfirm}
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : confirmText}
            </TouchButton>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};