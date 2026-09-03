const getLocalDeviceExtensions = () => {
    const origin = (typeof window !== 'undefined' && window.location &&
        window.location.origin) ? window.location.origin : '';
    return [
        {
            name: 'Classroom Kit',
            extensionId: 'classroomKit',
            version: '1.0.0',
            supportDevice: [
                'arduinoUno',
                'arduinoNano',
                'arduinoLeonardo',
                'arduinoMega2560',
                'arduinoEsp32',
                'arduinoEsp32S3'
            ],
            author: 'basheer.diy',
            iconURL: `${origin}/static/extensions/classroomkit/assets/icon.svg`,
            description: 'LED, button, and buzzer blocks for classroom boards.',
            featured: true,
            official: false,
            tags: ['actuator'],
            blocks: `${origin}/static/extensions/classroomkit/blocks.js`,
            generator: `${origin}/static/extensions/classroomkit/generator.js`,
            toolbox: `${origin}/static/extensions/classroomkit/toolbox.js`,
            translations: `${origin}/static/extensions/classroomkit/translations.js`
        },
        {
            name: 'Blynk IoT',
            extensionId: 'blynkIoT',
            version: '1.2.0',
            supportDevice: [
                'arduinoEsp32',
                'arduinoEsp32S3',
                'makerEsp32_arduinoEsp32'
            ],
            author: 'basheer.diy',
            iconURL: `${origin}/static/extensions/blynkiot/assets/icon.svg`,
            description: 'Connect ESP32 to Blynk with template, WiFi, GPIO bridges, and serial logs.',
            featured: true,
            official: false,
            internetConnectionRequired: true,
            tags: ['communication'],
            blocks: `${origin}/static/extensions/blynkiot/blocks.js`,
            generator: `${origin}/static/extensions/blynkiot/generator.js`,
            toolbox: `${origin}/static/extensions/blynkiot/toolbox.js`,
            translations: `${origin}/static/extensions/blynkiot/translations.js`
        },
        {
            name: 'Maker ESP32',
            extensionId: 'makerEsp32',
            version: '2.0.0',
            supportDevice: [
                'makerEsp32_arduinoEsp32'
            ],
            author: 'basheer.diy',
            iconURL: `${origin}/static/extensions/makerEsp32/assets/icon.svg`,
            description: 'RJ11 port blocks and Maker Blynk bridges for the Maker ESP32 board.',
            featured: true,
            official: false,
            tags: ['actuator', 'sensor', 'communication'],
            preload: [`${origin}/static/extensions/makerEsp32/pin-map.js`],
            blocks: `${origin}/static/extensions/makerEsp32/blocks.js`,
            generator: `${origin}/static/extensions/makerEsp32/generator.js`,
            toolbox: `${origin}/static/extensions/makerEsp32/toolbox.js`,
            translations: `${origin}/static/extensions/makerEsp32/translations.js`
        }
    ];
};

const mergeLocalDeviceExtensions = list => {
    const merged = Array.isArray(list) ? list.slice() : [];
    getLocalDeviceExtensions().forEach(ext => {
        if (!merged.some(item => item.extensionId === ext.extensionId)) {
            merged.unshift(ext);
        }
    });
    return merged;
};

/**
 * Stamp isLoaded from the VM so library cards show Loaded / Not loaded correctly.
 * @param {Array} list - device extension descriptors
 * @param {object} vm - OpenBlock VM
 * @returns {Array} list with isLoaded flags
 */
const withDeviceExtensionLoadState = (list, vm) => {
    const extensions = Array.isArray(list) ? list : [];
    if (!vm || !vm.extensionManager ||
        typeof vm.extensionManager.isDeviceExtensionLoaded !== 'function') {
        return extensions;
    }
    return extensions.map(ext => Object.assign({}, ext, {
        isLoaded: vm.extensionManager.isDeviceExtensionLoaded(ext.extensionId)
    }));
};

export {
    getLocalDeviceExtensions,
    mergeLocalDeviceExtensions,
    withDeviceExtensionLoadState
};
