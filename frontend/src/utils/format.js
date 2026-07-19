export function currency(amount, currencyCode = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode, maximumFractionDigits: 0 }).format(amount);
}

export function trustLabel(level) {
  return (
    {
      unverified: "Unverified",
      verified: "Verified",
      gold: "Gold supplier",
      platinum: "Platinum supplier",
    }[level] || level
  );
}
