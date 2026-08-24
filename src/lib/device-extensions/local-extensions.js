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
            iconURL: `${origin}/static/extensions/classroomKit/assets/icon.svg`,
            description: 'LED, button, and buzzer blocks for classroom boards.',
            featured: true,
            official: false,
            tags: ['actuator'],
            blocks: `${origin}/static/extensions/classroomKit/blocks.js`,
            generator: `${origin}/static/extensions/classroomKit/generator.js`,
            toolbox: `${origin}/static/extensions/classroomKit/toolbox.js`,
            translations: `${origin}/static/extensions/classroomKit/translations.js`
        },
        {
            name: 'Blynk IoT',
            extensionId: 'blynkIoT',
            version: '1.0.0',
            supportDevice: [
                'arduinoEsp32',
                'arduinoEsp32S3'
            ],
            author: 'basheer.diy',
            iconURL: `${origin}/static/extensions/blynkIoT/assets/icon.svg`,
            description: 'Connect ESP32 to the Blynk app with virtual pins for IoT learning.',
            featured: true,
            official: false,
            internetConnectionRequired: true,
            tags: ['communication'],
            blocks: `${origin}/static/extensions/blynkIoT/blocks.js`,
            generator: `${origin}/static/extensions/blynkIoT/generator.js`,
            toolbox: `${origin}/static/extensions/blynkIoT/toolbox.js`,
            translations: `${origin}/static/extensions/blynkIoT/translations.js`
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

export {
    getLocalDeviceExtensions,
    mergeLocalDeviceExtensions
};
