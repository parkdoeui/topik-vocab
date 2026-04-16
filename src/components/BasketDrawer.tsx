import { useEffect } from "react";
import type { VocabWord } from "../types";
import WordCard from "./WordCard";

interface BasketDrawerProps {
  open: boolean;
  basket: VocabWord[];
  onClose: () => void;
  onWordRemoved: () => void;
}

export default function BasketDrawer({
  open,
  basket,
  onClose,
  onWordRemoved,
}: BasketDrawerProps) {
  // Lock body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`md:hidden fixed inset-0 bg-black/40 z-30 transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Word Basket"
        className={`md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white rounded-t-2xl shadow-2xl transition-transform duration-300 max-h-[80vh] flex flex-col ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">
            Word Basket
            {basket.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-400">
                {basket.length} word{basket.length !== 1 ? "s" : ""}
              </span>
            )}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close basket"
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {/* Word list */}
        <div className="overflow-y-auto flex-1 px-4 pb-safe">
          {basket.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              <p>No saved words yet.</p>
              <p className="mt-1">Tap any Korean word to save it.</p>
            </div>
          ) : (
            basket
              .slice()
              .reverse()
              .map((word) => (
                <WordCard key={word.id} word={word} onRemoved={onWordRemoved} />
              ))
          )}
        </div>
      </div>
    </>
  );
}
