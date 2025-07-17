import React from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  children,
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-gray-900 rounded-lg shadow-lg p-6 max-w-md w-full relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-white text-2xl font-bold"
          aria-label="Close"
        >
          &times;
        </button>
        {title && (
          <h2 className="text-xl font-bold mb-4 text-white">{title}</h2>
        )}
        <div className="text-gray-200">{children}</div>
      </div>
    </div>
  );
};
