import loadjs from 'loadjs';
import log from '../log';
import {mergeLocalDeviceExtensions, withDeviceExtensionLoadState} from './local-extensions';

/**
 * Merge remote/local device extension catalogs onto the VM extension manager.
 * @param {object} vm - OpenBlock VM instance
 * @returns {Array} merged extension list
 */
const ensureDeviceExtensionsList = vm => {
    const current = (vm.extensionManager && vm.extensionManager._deviceExtensionsList) || [];
    const merged = withDeviceExtensionLoadState(mergeLocalDeviceExtensions(current), vm);
    vm.extensionManager._deviceExtensionsList = merged;
    return merged;
};

/**
 * Load optional preload scripts (e.g. pin-map) then a device extension.
 * @param {object} vm - OpenBlock VM instance
 * @param {string} extensionId - extension id to load
 * @returns {Promise}
 */
const loadOneDeviceExtension = (vm, extensionId) => {
    if (!extensionId) {
        return Promise.resolve();
    }
    if (vm.extensionManager.isDeviceExtensionLoaded(extensionId)) {
        return Promise.resolve();
    }

    const list = ensureDeviceExtensionsList(vm);
    const ext = list.find(item => item.extensionId === extensionId);
    if (!ext) {
        log.warn(`Device extension not found: ${extensionId}`);
        return Promise.resolve();
    }

    const preloads = (ext.preload || []).filter(Boolean);
    const runLoad = () => vm.extensionManager.loadDeviceExtension(extensionId);

    if (!preloads.length) {
        return runLoad().catch(err => {
            log.warn(`Failed to load device extension ${extensionId}`, err);
        });
    }

    return loadjs(preloads, {returnPromise: true})
        .catch(err => {
            log.warn(`Failed to preload scripts for ${extensionId}`, err);
        })
        .then(() => runLoad())
        .catch(err => {
            log.warn(`Failed to load device extension ${extensionId}`, err);
        });
};

/**
 * Install device extensions in order (auto-load on board select).
 * @param {object} vm - OpenBlock VM instance
 * @param {Array<string>|null} extensionIds - ids to install
 * @returns {Promise}
 */
const installDeviceExtensions = (vm, extensionIds) => {
    const ids = Array.isArray(extensionIds) ? extensionIds.filter(Boolean) : [];
    if (!ids.length) {
        return Promise.resolve();
    }

    return vm.extensionManager.getDeviceExtensionsList()
        .catch(() => null)
        .then(() => {
            ensureDeviceExtensionsList(vm);
            return ids.reduce(
                (chain, id) => chain.then(() => loadOneDeviceExtension(vm, id)),
                Promise.resolve()
            );
        });
};

export {
    ensureDeviceExtensionsList,
    installDeviceExtensions
};
