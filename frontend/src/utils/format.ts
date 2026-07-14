const WEI_PER_ETH = 1_000000000000000000n;

export function weiToEth(wei: string): string {
  const value = BigInt(wei);
  const whole = value / WEI_PER_ETH;
  const frac = value % WEI_PER_ETH;
  const fracStr = frac.toString().padStart(18, "0").replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}

export function ethToWei(eth: string): string {
  const [wholeStr, fracStr = ""] = eth.split(".");
  const fracPadded = (fracStr + "0".repeat(18)).slice(0, 18);
  const whole = BigInt(wholeStr || "0");
  const frac = BigInt(fracPadded || "0");
  return (whole * WEI_PER_ETH + frac).toString();
}
