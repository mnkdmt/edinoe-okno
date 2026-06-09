document.querySelectorAll('input[name="phone"]').forEach((inp) => {
  const format = (digits) => {
    let d = digits.replace(/\D/g, '');
    if (d.startsWith('8')) d = '7' + d.slice(1);
    if (!d.startsWith('7')) d = '7' + d;
    d = d.slice(0, 11);
    let out = '+7';
    if (d.length > 1) out += ' (' + d.slice(1, 4);
    if (d.length >= 4) out += ') ' + d.slice(4, 7);
    if (d.length >= 7) out += '-' + d.slice(7, 9);
    if (d.length >= 9) out += '-' + d.slice(9, 11);
    return out;
  };
  inp.addEventListener('input', () => { inp.value = format(inp.value); });
  inp.addEventListener('focus', () => { if (!inp.value) inp.value = '+7 ('; });
});
