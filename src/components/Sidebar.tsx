import type { VocabWord } from "../types";
import WordCard from "./WordCard";

interface SidebarProps {
  basket: VocabWord[];
  onWordRemoved: () => void;
}

export default function Sidebar({ basket, onWordRemoved }: SidebarProps) {
  return (
    <aside className="hidden md:flex flex-col w-72 shrink-0 bg-white border-l border-gray-200 overflow-y-auto">
      <div className="px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-10">
        <h2 className="text-sm font-semibold text-gray-700">
          Word Basket
          {basket.length > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-400">
              {basket.length} word{basket.length !== 1 ? "s" : ""}
            </span>
          )}
        </h2>
      </div>

      <div className="flex-1 px-4">
        {basket.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">
            <p>No saved words yet.</p>
            <p className="mt-1">Click any Korean word to save it.</p>
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
    </aside>
  );
}
