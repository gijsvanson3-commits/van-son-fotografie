export function getPackages(config, photographyId) {
  const category = config.photography.find(item => item.id === photographyId);
  if (!category) return [];
  const allowed = category.packageIds || config.packages.map(item => item.id);
  return config.packages.filter(pack => allowed.includes(pack.id)).map(pack => ({ ...pack, ...category.packageOverrides?.[pack.id], id: pack.id }));
}

export function getPackageUpgrade(packages, pack) {
  const base = packages.find(item => item.id === pack.compareTo);
  if (!base || pack.minutes !== base.minutes || pack.priceCents <= base.priceCents || pack.photos <= base.photos) return null;
  return { extraCents: pack.priceCents - base.priceCents, extraPhotos: pack.photos - base.photos };
}

export function calculatePrice(config, selection) {
  const pack = getPackages(config, selection.photography).find(item => item.id === selection.package);
  if (!pack || !config.photography.some(item => item.id === selection.photography)) return null;
  if (!Number.isInteger(selection.extraPhotos) || selection.extraPhotos < 0 || selection.extraPhotos > config.extras.maxExtraPhotos || typeof selection.rush !== 'boolean') return null;
  return {
    package: pack,
    extraCents: selection.extraPhotos * config.extras.photoPriceCents,
    rushCents: selection.rush ? config.extras.rushPriceCents : 0,
    totalCents: pack.priceCents + selection.extraPhotos * config.extras.photoPriceCents + (selection.rush ? config.extras.rushPriceCents : 0),
    totalPhotos: pack.photos + selection.extraPhotos
  };
}

export function formatMoney(cents, currency = 'EUR') {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency, minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
}
