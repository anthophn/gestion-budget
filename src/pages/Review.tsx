import { useEffect, useState } from 'react';
import { CircleCheck, CircleX, Hourglass } from 'lucide-react';
import { useData } from '../state';
import { useNav } from '../nav';
import { CATEGORIES, catColor, kakeiboScore } from '../lib/kakeibo';
import { improvementTips } from '../lib/insights';
import { money, pct } from '../lib/format';
import { monthLabel, shiftMonth } from '../lib/dates';
import { Card } from '../components/ui';
import { CategoryBadge } from '../components/CategoryIcon';
import type { Reflection } from '../lib/types';

const QUESTIONS: { key: keyof Reflection; label: string; placeholder: string }[] = [
  { key: 'good', label: 'Ce dont je suis fier·e ce mois-ci', placeholder: 'Ex. j’ai cuisiné au lieu de commander, j’ai tenu mon budget courses…' },
  { key: 'improve', label: 'Ce que je veux améliorer', placeholder: 'Ex. trop de petits achats en ligne le soir…' },
  { key: 'commitment', label: 'Mon engagement pour le mois prochain', placeholder: 'Ex. une seule sortie restaurant par semaine…' },
];

export function Review() {
  const { summary, saveMonth } = useData();
  const { month, go } = useNav();
  const s = summary(month);
  const prev = summary(shiftMonth(month, -1));
  const score = kakeiboScore(s);
  const tips = improvementTips(s);
  const available = s.income - s.fixed;
  const reached = s.actualSavings >= s.savingsGoal;

  return (
    <div className="page review">
      <div className="page-head">
        <div>
          <h2 className="page-title">Bilan de {monthLabel(month).toLowerCase()}</h2>
          <p className="muted">Les 4 questions du Kakeibo, pour faire le point et repartir du bon pied.</p>
        </div>
        {score && (
          <div className="review-score">
            <span>Score</span>
            <strong>{score.score}</strong>
            <small>/100</small>
          </div>
        )}
      </div>

      {s.isCurrent && (
        <p className="banner banner-soft">
          <Hourglass size={16} /> Le mois n’est pas terminé : ce bilan est provisoire ({s.daysLeft} jour{s.daysLeft > 1 ? 's' : ''} restant{s.daysLeft > 1 ? 's' : ''}).
        </p>
      )}

      <div className="questions">
        <Card className="question">
          <span className="q-num">1</span>
          <h3>Combien d’argent avais-je ?</h3>
          {s.hasPlan ? (
            <>
              <p className="q-answer">{money(available)}</p>
              <p className="muted">
                {money(s.income)} de revenus − {money(s.fixed)} de charges fixes.
              </p>
            </>
          ) : (
            <p className="muted">
              Renseigne tes revenus et charges fixes dans{' '}
              <button type="button" className="link-btn inline" onClick={() => go('plan')}>
                Budget du mois
              </button>
              .
            </p>
          )}
        </Card>

        <Card className="question">
          <span className="q-num">2</span>
          <h3>Combien voulais-je économiser ?</h3>
          <p className="q-answer">{money(s.savingsGoal)}</p>
          {s.hasPlan && (
            <p className={`icon-text ${s.isCurrent ? 'muted' : reached ? 'good-text' : 'bad-text'}`}>
              {s.isCurrent ? <Hourglass size={16} /> : reached ? <CircleCheck size={16} /> : <CircleX size={16} />}
              {s.isCurrent ? `Au rythme actuel, tu épargneras environ ${money(s.income - s.fixed - s.projectedSpent)}` : reached ? `Objectif atteint : ${money(s.actualSavings)} épargnés` : `Objectif manqué : ${money(s.actualSavings)} épargnés`}
            </p>
          )}
        </Card>

        <Card className="question">
          <span className="q-num">3</span>
          <h3>Combien ai-je dépensé ?</h3>
          <p className="q-answer">{money(s.spent)}</p>
          {prev.spent > 0 && (
            <p className="muted">
              {s.spent >= prev.spent ? '+' : '−'}
              {money(Math.abs(s.spent - prev.spent))} par rapport à {monthLabel(prev.month, false).toLowerCase()} ({money(prev.spent)}).
            </p>
          )}
          <ul className="q-cats">
            {CATEGORIES.map((c) => (
              <li key={c.id}>
                <CategoryBadge category={c.id} size={24} />
                <span>{c.label}</span>
                <span className="q-bar">
                  <span style={{ width: `${s.spent > 0 ? (s.byCat[c.id].spent / s.spent) * 100 : 0}%`, background: catColor(c.id) }} />
                </span>
                <strong>{money(s.byCat[c.id].spent)}</strong>
                <small className="muted">{pct(s.byCat[c.id].share)}</small>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="question question-wide">
          <span className="q-num">4</span>
          <h3>Comment puis-je m’améliorer ?</h3>
          <ul className="tips">
            {tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <div className="reflections">
            {QUESTIONS.map((q) => (
              <ReflectionField key={`${month}-${q.key}`} label={q.label} placeholder={q.placeholder} value={s.plan.reflection[q.key] ?? ''} onSave={(v) => saveMonth(month, { reflection: { ...s.plan.reflection, [q.key]: v } })} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ReflectionField({ label, placeholder, value, onSave }: { label: string; placeholder: string; value: string; onSave: (v: string) => Promise<boolean> }) {
  const [text, setText] = useState(value);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(value);
  }, [value, focused]);
  return (
    <label className="field">
      <span>
        {label} {state === 'saving' ? <small className="muted">· enregistrement…</small> : state === 'saved' ? <small className="good-text">· enregistré</small> : null}
      </span>
      <textarea
        rows={3}
        value={text}
        placeholder={placeholder}
        maxLength={2000}
        onFocus={() => setFocused(true)}
        onChange={(e) => setText(e.target.value)}
        onBlur={async () => {
          setFocused(false);
          if (text === value) return;
          setState('saving');
          const ok = await onSave(text.trim());
          setState(ok ? 'saved' : 'idle');
        }}
      />
    </label>
  );
}
