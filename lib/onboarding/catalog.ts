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
    description: template.description,
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
      templates: set.items.map((item) => {
        const source = templates.find((row) => row.id === item.templateId);
        return {
          id: item.templateId,
          name: item.name,
          description: source?.description ?? null,
          visibility: starterVisibility(item.visibility),
          recipe: source?.recipe ?? null,
        };
      }),
    })),
    loose,
  );
}
