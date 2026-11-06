import {useMemo} from 'react';

import {generateArduino} from '../domain/codegen';

/**
 * Preview code: Cloud secrets are always masked here; real ones are injected only at upload.
 * The AI's examples are left out too (they run to hundreds of lines); Upload and Copy add them.
 */
const useGeneratedCode = (connections, program, cloud, ai) => useMemo(
    () => generateArduino(connections, program, {cloud, ai}),
    [connections, program, cloud, ai]
);

export default useGeneratedCode;
