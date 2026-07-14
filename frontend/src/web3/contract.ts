import { Contract, type Signer } from "ethers";
import abi from "../contracts/Marketplace.abi.json";
import { getContractInfo } from "../api/client";

let cachedInfo: { address: string; chainId: number } | undefined;

export async function getContractInfoCached() {
  cachedInfo ??= await getContractInfo();
  return cachedInfo;
}

export async function getMarketplaceContract(signer: Signer) {
  const info = await getContractInfoCached();
  return new Contract(info.address, abi, signer);
}
