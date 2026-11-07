/* eslint-disable no-console */
// Prints the MicroPython that Beginner Studio writes for every built-in template, plus
// "extra-" projects for parts no template uses yet, as JSON:
//   {"<template id>": {"name": ..., "code": ..., "gaps": [...]}}
// Usage (repo root): node prototypes/micropython/tools/studio_python.js
const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SRC = path.join(ROOT, 'src');

const compile = require.extensions['.js'];
require.extensions['.js'] = (module, filename) => {
    if (!filename.startsWith(SRC)) {
        return compile(module, filename);
    }
    const {code} = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
        filename,
        babelrc: false,
        configFile: false,
        presets: [['@babel/preset-env', {targets: {node: 'current'}, modules: 'commonjs'}]]
    });
    module._compile(code, filename);
};

const {TEMPLATES} = require(path.join(SRC, 'beginner-studio', 'domain', 'templates.js'));
const {generatePython, micropythonGaps} = require(path.join(SRC, 'beginner-studio', 'domain', 'pycodegen.js'));
const {createBlock} = require(path.join(SRC, 'beginner-studio', 'domain', 'tree.js'));

const hc05 = {id: 'conn-hc05', moduleId: 'hc05', portId: 'UART', pin: '3'};
const led = {id: 'conn-led', moduleId: 'led', portId: 'D13', pin: '33'};
const EXTRA = [{
    id: 'extra-hc05-echo',
    name: 'HC-05 echo',
    connections: [hc05, led],
    program: [
        createBlock('hc05_read', {cid: hc05.id}),
        createBlock('if_then', {
            params: {sensor: 'hc05Line', op: 'is', value: 0},
            children: [
                createBlock('hc05_send', {cid: hc05.id, params: {text: 'got it'}}),
                createBlock('turn_on', {cid: led.id})
            ]
        }),
        createBlock('wait', {params: {seconds: 0.2}})
    ]
}];

const out = {};
TEMPLATES.concat(EXTRA).forEach(t => {
    out[t.id] = {
        name: t.name,
        code: generatePython(t.connections, t.program),
        gaps: micropythonGaps(t.connections, t.program)
    };
});
process.stdout.write(JSON.stringify(out));
