import {useMemo} from 'react';

import {generateArduino} from '../domain/codegen';

const useGeneratedCode = (connections, program) => useMemo(
    () => generateArduino(connections, program),
    [connections, program]
);

export default useGeneratedCode;
