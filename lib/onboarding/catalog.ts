import {
  onboardingFolders,
  type StarterFolder,
} from "@/lib/onboarding/model";
import { listAllSets } from "@/lib/templates/store";

export async function listOnboardingFolders(): Promise<StarterFolder[]> {
  const sets = await listAllSets({ visibility: "platform" });
  return onboardingFolders(
    sets.map((set) => ({
      id: set.id,
      name: set.name,
      deskType: set.deskType,
      visibility: set.visibility,
      starterPack: set.starterPack,
      templates: set.items.map((item) => ({
        id: item.templateId,
        name: item.name,
        visibility: item.visibility,
      })),
    })),
  );
}
