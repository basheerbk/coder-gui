import {useMemo} from 'react';

import {generateArduino} from '../domain/codegen';

/** Preview code: Cloud secrets are always masked here; real ones are injected only at upload. */
const useGeneratedCode = (connections, program, cloud) => useMemo(
    () => generateArduino(connections, program, {cloud}),
    [connections, program, cloud]
);

export default useGeneratedCode;
