import {useMemo} from 'react';

import {MICROPYTHON} from '../domain/boardLanguage';
import {generateArduino} from '../domain/codegen';
import {generatePython} from '../domain/pycodegen';

// Preview code: Cloud secrets are always masked here; real ones are injected only at upload.
// The AI's examples are left out too (they run to hundreds of lines); Upload and Copy add them.
// `target` is what the board will run (boardTarget in pycodegen.js): main.py or an Arduino sketch.
const useGeneratedCode = (connections, program, cloud, ai, target) => useMemo(
    () => (target === MICROPYTHON ?
        generatePython(connections, program) :
        generateArduino(connections, program, {cloud, ai})),
    [connections, program, cloud, ai, target]
);

export default useGeneratedCode;
