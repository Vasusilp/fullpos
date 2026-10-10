'use client';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, children, wide = false }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`card glass w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] flex flex-col rounded-[32px]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h3 className="text-sm font-bold uppercase tracking-widest">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="px-6 pb-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
