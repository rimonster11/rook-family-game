'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Style = require('../public/js/style-options');

test('studio choices are bounded, independent, and leave the special model unchanged', async () => {
  globalThis.RookStyle = Style;
  const { CHARACTERS } = await import('../public/js/art.js');
  for (const [key, choices] of Object.entries(Style.options)) {
    assert.deepEqual(Style.normalize({ [key]: choices.length }), {});
    assert.deepEqual(Style.normalize({ [key]: -1 }), {});
    assert.deepEqual(Style.normalize({ [key]: 0.5 }), {});
    assert.deepEqual(Style.normalize({ [key]: choices.length - 1 }), { [key]: choices.length - 1 });
  }
  const basic = Style.apply(CHARACTERS[0], {});
  assert.equal(basic.hat, 'none'); assert.equal(basic.glasses, 'none');
  assert.equal(basic.accessory, 'none'); assert.equal(basic.facialHair, 'none');
  const styled = Style.apply(CHARACTERS[0], { style: 3, outfit: 2, shirt: 4, expression: 4 });
  assert.equal(styled.style, 'long'); assert.equal(styled.outfit, 'jacket');
  assert.equal(styled.expression, 'wink'); assert.equal(styled.hair, basic.hair);
  assert.deepEqual(styled.palette, Style.palettes[4]);
  assert.equal(new Set(Object.values(styled.palette).slice(1)).size, 3);
  const choices = Object.fromEntries(Object.entries(Style.options).map(([k,v]) => [k,v.length-1]));
  assert.deepEqual(Style.apply(CHARACTERS[12], choices), CHARACTERS[12]);
});

test('every new wardrobe option produces finite geometry and a matching SVG', async () => {
  globalThis.RookStyle = Style;
  const { buildCharacter, disposeCharacter } = await import('../public/js/characters.js');
  const { avatarSVG } = await import('../public/js/art.js');
  for (const key of ['style', 'expression', 'outfit', 'accessory', 'facialHair', 'eyeColor']) {
    for (let index = 0; index < Style.options[key].length; index++) {
      const appearance = { shirt: index % 6, skin: index % 6, [key]: index };
      const character = buildCharacter(0, appearance);
      character.traverse(o => {
        if (!o.isMesh) return;
        assert.ok(Array.from(o.geometry.attributes.position.array).every(Number.isFinite), `${key}:${index}`);
        assert.ok(!/cheek/i.test(o.name), 'No raised cheek geometry');
      });
      const svg = avatarSVG(0, { appearance });
      assert.match(svg, /<svg/); assert.doesNotMatch(svg, /NaN|undefined/);
      disposeCharacter(character);
    }
  }
});
