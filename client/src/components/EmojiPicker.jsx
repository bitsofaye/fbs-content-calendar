import { useEffect, useRef, useState } from 'react';
import { SmilePlus, X } from 'lucide-react';

// Emojis that suit content pillars; any other emoji can be typed or pasted in the box
const GROUPS = [
  ['Business', ['💼', '📊', '📈', '💰', '🧾', '🏢', '🤝', '📑', '🧮', '💳', '⚖️', '🏦']],
  ['Content', ['💡', '📣', '📢', '📝', '✍️', '📚', '🎓', '🎥', '📷', '🎙️', '💬', '📱']],
  ['People & events', ['🎉', '🎂', '🥳', '🙏', '👥', '🧑‍💼', '❤️', '⭐', '🏆', '🎄', '🎯', '📅']],
  ['Services', ['💻', '🌐', '🛠️', '🧑‍💻', '📦', '🚀', '🔒', '🏠', '🍽️', '🩺', '🌱', '☀️']],
  ['Moods', ['🔥', '✅', '✨', '💪', '😊', '🤔', '👏', '🙌', '📌', '🔔', '🎁', '🌟']],
];

/** A small button that opens an emoji grid. value = emoji or null; onChange(emoji | null). */
export default function EmojiPicker({ value, onChange, color }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const btn = useRef(null);

  // the grid floats above the page, so a scrolling table can't cut it off
  const toggle = () => {
    if (open) return setOpen(false);
    const r = btn.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom > 430;
    setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - 296)), ...(below ? { top: r.bottom + 4 } : { bottom: window.innerHeight - r.top + 4 }) });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    const shut = () => setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    window.addEventListener('resize', shut);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
      window.removeEventListener('resize', shut);
    };
  }, [open]);

  const choose = (emoji) => {
    onChange(emoji || null);
    setTyped('');
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        ref={btn}
        type="button"
        onClick={toggle}
        className="flex h-8 w-10 cursor-pointer items-center justify-center rounded border border-slate-300 bg-white text-lg leading-none hover:border-brand-500"
        title={value ? 'Change icon' : 'Add an icon'}
        aria-label={value ? `Icon ${value}, change` : 'Add an icon'}
        style={!value && color ? { color } : undefined}
      >
        {value || <SmilePlus className="h-4 w-4" />}
      </button>
      {open && (
        <div className="fixed z-50 w-[284px] rounded-xl border border-slate-200 bg-white p-3 shadow-lift" style={pos}>
          {GROUPS.map(([label, list]) => (
            <div key={label} className="mb-2">
              <div className="mb-1 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">{label}</div>
              <div className="grid grid-cols-6 gap-1">
                {list.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => choose(e)}
                    className={`flex h-9 cursor-pointer items-center justify-center rounded-lg text-xl hover:bg-brand-50 ${value === e ? 'bg-brand-100 ring-1 ring-brand-500' : ''}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="mt-2 flex gap-2 border-t border-slate-100 pt-2">
            <input
              className="input py-1 text-sm"
              placeholder="Or type / paste one…"
              value={typed}
              maxLength={8}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && typed.trim() && (e.preventDefault(), choose(typed.trim()))}
            />
            <button type="button" className="btn-primary px-2.5 py-1 text-xs" disabled={!typed.trim()} onClick={() => choose(typed.trim())}>
              Use
            </button>
          </div>
          {value && (
            <button type="button" className="btn-ghost mt-2 w-full py-1 text-xs text-red-600" onClick={() => choose(null)}>
              <X className="h-3.5 w-3.5" /> No icon
            </button>
          )}
        </div>
      )}
    </div>
  );
}
