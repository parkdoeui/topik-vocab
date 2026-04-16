import type { VocabWord } from "../types";

const BASKET_KEY = "topik-vocab-basket";

export function getBasket(): VocabWord[] {
  try {
    const data = localStorage.getItem(BASKET_KEY);
    return data ? (JSON.parse(data) as VocabWord[]) : [];
  } catch {
    return [];
  }
}

export function addWord(word: VocabWord): void {
  const basket = getBasket();
  if (!basket.find((w) => w.id === word.id)) {
    basket.push(word);
    localStorage.setItem(BASKET_KEY, JSON.stringify(basket));
  }
}

export function removeWord(id: string): void {
  const basket = getBasket().filter((w) => w.id !== id);
  localStorage.setItem(BASKET_KEY, JSON.stringify(basket));
}
