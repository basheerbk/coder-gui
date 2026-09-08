/**
 * Sprites/costumes hosted under /static/sprites/{md5}.{ext}
 * instead of the upstream CDN.
 */
const LOCAL_SPRITE_ASSET_IDS = new Set([
    '1cf36a1be1c4e229c2f38cee179dd27d' // Robot
]);

const isLocalSpriteAsset = assetIdOrMd5ext => {
    if (!assetIdOrMd5ext) return false;
    const assetId = String(assetIdOrMd5ext).split('.')[0];
    return LOCAL_SPRITE_ASSET_IDS.has(assetId);
};

const getLocalSpriteUrl = md5ext => {
    if (!md5ext) return null;
    const normalized = md5ext.includes('.') ? md5ext : `${md5ext}.png`;
    return `static/sprites/${normalized}`;
};

export {
    LOCAL_SPRITE_ASSET_IDS,
    isLocalSpriteAsset,
    getLocalSpriteUrl
};
