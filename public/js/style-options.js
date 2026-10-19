// Shared, bounded appearance choices used by both the server and browser.
(function (root) {
  const options = {
    skin: ['#ffdcc2', '#f1c7a5', '#c68863', '#a86b49', '#6f4630', '#3e2618'],
    shirt: ['#2563eb', '#0f766e', '#e11d48', '#8b5cf6', '#f1f5f9', '#e3ae55'],
    hair: ['#24170f', '#6b4423', '#c9a46a', '#b5482b', '#cfd2d6', '#16100c'],
    hat: ['none', 'cap', 'beanie', 'headband', 'bowler', 'cowboy'],
    glasses: ['none', 'round', 'square', 'shades'],
  };
  function normalize(value) {
    const result = {};
    if (!value || typeof value !== 'object') return result;
    for (const [key, choices] of Object.entries(options)) {
      if (Number.isInteger(value[key]) && value[key] >= 0 && value[key] < choices.length) result[key] = value[key];
    }
    return result;
  }
  function apply(base, value) {
    const result = { ...base };
    for (const [key, index] of Object.entries(normalize(value))) result[key] = options[key][index];
    result.hatColor ||= result.shirt || '#334155';
    return result;
  }
  const api = { options, normalize, apply, characterCount: 13 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RookStyle = api;
})(globalThis);
