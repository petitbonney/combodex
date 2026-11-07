/** Libellés composés, communs à plusieurs écrans. */
import type { Messages } from '../../content/i18n/index.ts';
import type { ToolId } from '../../content/tools.ts';
import type { PokemonType, ShopConsumable } from '../../engine/index.ts';

export function toolLabel(
  text: Messages,
  tool: { toolId: ToolId; type: PokemonType | null },
): string {
  const { name } = text.tools[tool.toolId];
  return tool.type ? `${name} ${text.types[tool.type]}` : name;
}

export function consumableLabel(text: Messages, consumable: ShopConsumable): string {
  switch (consumable.kind) {
    case 'energy':
      return text.app.consumableEnergy(text.types[consumable.energy]);
    case 'special':
      return text.specials[consumable.special].name;
    case 'leap':
      return text.leap.name;
    case 'ace':
      return text.aces[consumable.ace].name;
  }
}

export function consumableEffect(text: Messages, consumable: ShopConsumable): string {
  switch (consumable.kind) {
    case 'energy':
      return text.app.energyEffect;
    case 'special':
      return text.specials[consumable.special].effect;
    case 'leap':
      return text.leap.effect;
    case 'ace':
      return text.aces[consumable.ace].effect;
  }
}
