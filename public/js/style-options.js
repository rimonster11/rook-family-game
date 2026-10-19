// Shared, bounded appearance choices used by both the server and browser.
(function (root) {
  const options = {
    skin: ['#ffdcc2', '#f1c7a5', '#c68863', '#a86b49', '#6f4630', '#3e2618'],
    shirt: ['#2563eb', '#0f766e', '#e11d48', '#8b5cf6', '#f1f5f9', '#e3ae55'],
    hair: ['#24170f', '#6b4423', '#c9a46a', '#b5482b', '#cfd2d6', '#16100c'],
    hat: ['none', 'cap', 'beanie', 'headband', 'bowler', 'cowboy'],
    glasses: ['none', 'round', 'square', 'shades'],
    style: ['short', 'swept', 'bob', 'long', 'bun', 'curly', 'afro', 'bald'],
    expression: ['smile', 'grin', 'calm', 'happy', 'wink'],
    outfit: ['crew', 'hoodie', 'jacket', 'cardigan'],
    accessory: ['none', 'studs', 'hoops', 'necklace', 'scarf'],
    facialHair: ['none', 'mustache', 'beard'],
    eyeColor: ['#604936', '#42766d', '#4d7196', '#71804c'],
  };
  // Primary, secondary and accent colors stay coordinated across every garment.
  const palettes = [
    { name: 'Harbor', primary: '#537fa6', secondary: '#243f59', accent: '#e9d6ac' },
    { name: 'Forest', primary: '#688c78', secondary: '#304d43', accent: '#e4c79b' },
    { name: 'Berry', primary: '#b67481', secondary: '#613b56', accent: '#f4d9ce' },
    { name: 'Lavender', primary: '#9690bb', secondary: '#504b70', accent: '#ece3cf' },
    { name: 'Cloud', primary: '#e5dece', secondary: '#617789', accent: '#bc865c' },
    { name: 'Sunset', primary: '#c58b61', secondary: '#774d46', accent: '#f3d9aa' },
  ];
  function normalize(value) {
    const result = {};
    if (!value || typeof value !== 'object') return result;
    for (const [key, choices] of Object.entries(options)) {
      if (Number.isInteger(value[key]) && value[key] >= 0 && value[key] < choices.length) result[key] = value[key];
    }
    return result;
  }
  function apply(base, value) {
    if (base.model) return { ...base };
    const result = { style: 'short', expression: 'smile', outfit: 'crew', accessory: 'none', facialHair: 'none', eyeColor: options.eyeColor[0], hat: 'none', glasses: 'none', ...base };
    for (const [key, index] of Object.entries(normalize(value))) result[key] = options[key][index];
    result.palette = palettes[Math.max(0, options.shirt.indexOf(result.shirt))];
    result.hatColor = result.palette.secondary;
    return result;
  }
  const api = { options, palettes, normalize, apply, characterCount: 13 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RookStyle = api;
})(globalThis);
