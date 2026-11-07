/** Libellés composés, communs à plusieurs écrans. */
import type { Messages } from '../../content/i18n/index.ts';
import type { ToolId } from '../../content/tools.ts';
import type { PokemonType } from '../../engine/index.ts';

export function toolLabel(
  text: Messages,
  tool: { toolId: ToolId; type: PokemonType | null },
): string {
  const { name } = text.tools[tool.toolId];
  return tool.type ? `${name} ${text.types[tool.type]}` : name;
}
