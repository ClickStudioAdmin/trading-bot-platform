import {
  appendLooseStarterTemplates,
  type StarterFolder,
  type StarterLooseTemplate,
  type StarterVisibility,
} from "@/lib/onboarding/model";
import { listAllSets, listAllTemplates } from "@/lib/templates/store";

function starterVisibility(value: string): StarterVisibility {
  if (value === "platform" || value === "backtested") {
    return value;
  }
  return "user";
}

export async function listOnboardingFolders(): Promise<StarterFolder[]> {
  const [sets, templates] = await Promise.all([
    listAllSets({ visibility: "platform" }),
    listAllTemplates({ visibility: "platform" }),
  ]);
  const loose: StarterLooseTemplate[] = templates.map((template) => ({
    id: template.id,
    name: template.name,
    visibility: starterVisibility(template.visibility),
    deskType: template.deskType,
    starterPack: template.starterPack,
    recipe: template.recipe,
  }));
  return appendLooseStarterTemplates(
    sets.map((set) => ({
      id: set.id,
      name: set.name,
      deskType: set.deskType,
      visibility: starterVisibility(set.visibility),
      starterPack: set.starterPack,
      templates: set.items.map((item) => ({
        id: item.templateId,
        name: item.name,
        visibility: starterVisibility(item.visibility),
        recipe:
          templates.find((row) => row.id === item.templateId)?.recipe ?? null,
      })),
    })),
    loose,
  );
}
