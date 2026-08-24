import ScratchStorage from 'scratch-storage';

import defaultProject from './default-project';
import {isLocalSpriteAsset} from './local-sprites';

/**
 * Wrapper for ScratchStorage which adds default web sources.
 * @todo make this more configurable
 */
class Storage extends ScratchStorage {
    constructor () {
        super();
        this.cacheDefaultProject();
    }
    addOfficialScratchWebStores () {
        // Custom sprites hosted under /static/sprites/{md5}.{ext}
        this.addWebStore(
            [this.AssetType.ImageVector, this.AssetType.ImageBitmap],
            this.getLocalSpriteGetConfig.bind(this)
        );
        this.addWebStore(
            [this.AssetType.Project],
            this.getProjectGetConfig.bind(this),
            this.getProjectCreateConfig.bind(this),
            this.getProjectUpdateConfig.bind(this)
        );
        this.addWebStore(
            [this.AssetType.ImageVector, this.AssetType.ImageBitmap, this.AssetType.Sound],
            this.getAssetGetConfig.bind(this),
            // We set both the create and update configs to the same method because
            // storage assumes it should update if there is an assetId, but the
            // asset store uses the assetId as part of the create URI.
            this.getAssetCreateConfig.bind(this),
            this.getAssetCreateConfig.bind(this)
        );
        this.addWebStore(
            [this.AssetType.Sound],
            asset => `static/extension-assets/scratch3_music/${asset.assetId}.${asset.dataFormat}`
        );
    }
    getLocalSpriteGetConfig (asset) {
        if (!isLocalSpriteAsset(asset.assetId)) {
            return false;
        }
        return `static/sprites/${asset.assetId}.${asset.dataFormat}`;
    }
    getLocalSpriteGetConfig (asset) {
        // Only serve assets that exist in static/sprites; otherwise try the next store.
        const localSpriteIds = new Set([
            '1cf36a1be1c4e229c2f38cee179dd27d' // Robot
        ]);
        if (!localSpriteIds.has(asset.assetId)) {
            return false;
        }
        return `static/sprites/${asset.assetId}.${asset.dataFormat}`;
    }
    getLocalSpriteGetConfig (asset) {
        // Only serve assets that exist in static/sprites; otherwise try the next store.
        const localSpriteIds = new Set([
            '1cf36a1be1c4e229c2f38cee179dd27d' // Robot
        ]);
        if (!localSpriteIds.has(asset.assetId)) {
            return false;
        }
        return `static/sprites/${asset.assetId}.${asset.dataFormat}`;
    }
    getLocalSpriteGetConfig (asset) {
        // Only serve assets that exist in static/sprites; otherwise try the next store.
        const localSpriteIds = new Set([
            '1cf36a1be1c4e229c2f38cee179dd27d' // Robot
        ]);
        if (!localSpriteIds.has(asset.assetId)) {
            return false;
        }
        return `static/sprites/${asset.assetId}.${asset.dataFormat}`;
    }
    setProjectHost (projectHost) {
        this.projectHost = projectHost;
    }
    getProjectGetConfig (projectAsset) {
        return `${this.projectHost}/${projectAsset.assetId}`;
    }
    getProjectCreateConfig () {
        return {
            url: `${this.projectHost}/`,
            withCredentials: true
        };
    }
    getProjectUpdateConfig (projectAsset) {
        return {
            url: `${this.projectHost}/${projectAsset.assetId}`,
            withCredentials: true
        };
    }
    setAssetHost (assetHost) {
        this.assetHost = assetHost;
    }
    getAssetGetConfig (asset) {
        return `${this.assetHost}/assets/${asset.assetId}.${asset.dataFormat}`;
    }
    getAssetCreateConfig (asset) {
        return {
            // There is no such thing as updating assets, but storage assumes it
            // should update if there is an assetId, and the asset store uses the
            // assetId as part of the create URI. So, force the method to POST.
            // Then when storage finds this config to use for the "update", still POSTs
            method: 'post',
            url: `${this.assetHost}/${asset.assetId}.${asset.dataFormat}`,
            withCredentials: true
        };
    }
    setTranslatorFunction (translator) {
        this.translator = translator;
        this.cacheDefaultProject();
    }
    cacheDefaultProject () {
        const defaultProjectAssets = defaultProject(this.translator);
        defaultProjectAssets.forEach(asset => this.builtinHelper._store(
            this.AssetType[asset.assetType],
            this.DataFormat[asset.dataFormat],
            asset.data,
            asset.id
        ));
    }
}

const storage = new Storage();

export default storage;
