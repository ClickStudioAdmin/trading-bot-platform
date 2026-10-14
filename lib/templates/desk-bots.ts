import { deskHomePath, type DeskType } from "@/lib/accounts/model";
import {
  recipesMatchReplayFields,
  templateFitsDesk,
  type TemplateDeskType,
  type TemplateRecipe,
} from "@/lib/templates/recipe";

export type TemplateDeskBot = {
  id: string;
  name: string;
  deskId: string;
  deskName: string;
  deskType: DeskType;
  recipe: TemplateRecipe;
};

export type TemplateBotLink = {
  id: string;
  deskId: string;
  name: string;
  deskName: string;
  href: string;
};

export function templateBotLinkLabel(bot: { name: string }): string {
  return bot.name;
}

export function templateBotLinks(
  template: { deskType: TemplateDeskType; recipe: TemplateRecipe },
  bots: readonly TemplateDeskBot[],
): TemplateBotLink[] {
  return bots
    .filter(
      (bot) =>
        templateFitsDesk(template.deskType, bot.deskType) &&
        recipesMatchReplayFields(template.recipe, bot.recipe),
    )
    .map((bot) => ({
      id: bot.id,
      deskId: bot.deskId,
      name: bot.name,
      deskName: bot.deskName,
      href: `${deskHomePath(bot.deskType, bot.deskId)}#bot-${bot.id}`,
    }))
    .sort((left, right) =>
      templateBotLinkLabel(left).localeCompare(templateBotLinkLabel(right)),
    );
}

export function templateBotLinksByTemplate(
  templates: readonly {
    id: string;
    deskType: TemplateDeskType;
    recipe: TemplateRecipe;
  }[],
  bots: readonly TemplateDeskBot[],
): Record<string, TemplateBotLink[]> {
  const links: Record<string, TemplateBotLink[]> = {};
  for (const template of templates) {
    const matches = templateBotLinks(template, bots);
    if (matches.length > 0) {
      links[template.id] = matches;
    }
  }
  return links;
}
