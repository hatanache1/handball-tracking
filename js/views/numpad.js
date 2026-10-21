// Digit pad for the shooter's jersey number. Optional: never tapping it blocks nothing.
// Each digit tap is one undo step (done by the caller), so "Zurück" also works as backspace.
// onDigit(0..9) fires on every tap; set(number | null) shows the current number without firing callbacks.
export function mountNumpad(el, { onDigit }) {
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
  el.innerHTML = `<div>Rückennummer: <b></b></div>
    <div class="numpad">${digits.map((d) => `<button class="big" data-digit="${d}">${d}</button>`).join('')}</div>`;
  const shown = el.querySelector('b');

  el.onclick = (e) => {
    if (e.target.dataset.digit) onDigit(Number(e.target.dataset.digit));
  };

  return { set: (number) => { shown.textContent = number ?? '–'; } };
}
