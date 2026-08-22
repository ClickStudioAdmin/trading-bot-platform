import { fetchBybitInstruments } from "./client";
import { pairCarryUniverse, type CarryPair } from "./universe";

export async function listCarryPairs(): Promise<CarryPair[]> {
  const [linear, spot] = await Promise.all([
    fetchBybitInstruments("linear"),
    fetchBybitInstruments("spot"),
  ]);
  return pairCarryUniverse(linear, spot, Date.now());
}
