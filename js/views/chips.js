// Comment chips (multi-select, from the season settings) plus the free-text note,
// which is the only keyboard field in the live view.
// onTags(newTagList) fires on every chip tap; onNote(text) on every keystroke (the caller merges them into one undo step).
// set(tags, note) shows the current values without firing callbacks (for undo).
export function mountChips(el, chips, { onTags, onNote }) {
  el.innerHTML = `<div class="chips"></div>
    <input type="text" placeholder="Notiz" style="width:100%;min-height:64px;font-size:20px;padding:0 12px">`;
  const list = el.querySelector('.chips');
  const input = el.querySelector('input');
  let tags = [];

  // Built with textContent so chip names from the settings can never be read as HTML.
  const buttons = chips.map((name) => {
    const b = document.createElement('button');
    b.className = 'big';
    b.textContent = name;
    b.onclick = () => onTags(tags.includes(name) ? tags.filter((t) => t !== name) : [...tags, name]);
    list.append(b);
    return b;
  });

  input.oninput = () => onNote(input.value);

  return {
    set(newTags, note) {
      tags = newTags ?? [];
      buttons.forEach((b) => b.setAttribute('aria-pressed', tags.includes(b.textContent)));
      if (input.value !== (note ?? '')) input.value = note ?? ''; // untouched while typing, so the caret stays
    },
  };
}
