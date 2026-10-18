import { BookOpen, ShoppingBasket, Sparkles, Zap, type LucideProps } from 'lucide-react';
import type { Category } from '../lib/types';
import { catColor } from '../lib/kakeibo';

const ICONS = { survie: ShoppingBasket, optionnel: Sparkles, culture: BookOpen, imprevus: Zap } as const;

export function CategoryIcon({ category, size = 18, ...rest }: { category: Category; size?: number } & LucideProps) {
  const Icon = ICONS[category];
  return <Icon size={size} {...rest} />;
}

/** Pastille ronde colorée avec l'icône de la catégorie. */
export function CategoryBadge({ category, size = 36 }: { category: Category; size?: number }) {
  return (
    <span className="cat-badge" style={{ width: size, height: size, background: catColor(category) }} aria-hidden>
      <CategoryIcon category={category} size={Math.round(size * 0.5)} />
    </span>
  );
}
