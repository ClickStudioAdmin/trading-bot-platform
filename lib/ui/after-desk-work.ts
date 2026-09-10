import { after } from "next/server";

export function afterDeskWork(
  label: string,
  work: () => Promise<void>,
): void {
  after(() =>
    work().catch((error) => {
      console.error(`afterDeskWork:${label}`, error);
    }),
  );
}
