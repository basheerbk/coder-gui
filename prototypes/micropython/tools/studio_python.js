/* eslint-disable no-console */
// Prints the MicroPython that Beginner Studio writes for every built-in template, as JSON:
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

const out = {};
TEMPLATES.forEach(t => {
    out[t.id] = {
        name: t.name,
        code: generatePython(t.connections, t.program),
        gaps: micropythonGaps(t.connections, t.program)
    };
});
process.stdout.write(JSON.stringify(out));
