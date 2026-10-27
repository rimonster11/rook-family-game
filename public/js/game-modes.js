// Shared descriptions for the two implemented fixed-partnership games only.
(function (root) {
  const profiles = Object.freeze({
    family4: Object.freeze({ id: 'family4', label: 'Family Four', players: 4, handSize: 9, nestSize: 5, minRank: 5, moon: true, autoFinish: true }),
    partnership6: Object.freeze({ id: 'partnership6', label: 'Partnership for Six', players: 6, handSize: 8, nestSize: 9, minRank: 1, moon: false, autoFinish: false }),
  });
  const api = { profiles, get: (id = 'family4') => Object.hasOwn(profiles, id) ? profiles[id] : null };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RookModes = api;
})(globalThis);
